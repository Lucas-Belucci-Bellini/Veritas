import { useMemo } from 'react'
import { Background, BackgroundVariant, Controls, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { AstNode, Assignment, Notation } from '../engine'
import { astToGraph, computeSignals } from '../circuit/graph'
import { layoutGraph } from '../circuit/layout'
import { LogicNode } from '../circuit/LogicNode'

const NODE_TYPES = { logic: LogicNode }

interface CircuitViewProps {
  ast: AstNode
  notation: Notation
  /** Linha da tabela selecionada; acende os fios com esses valores. */
  assignment: Assignment | null
}

/**
 * Desenha o circuito equivalente à expressão.
 *
 * O grafo é derivado da mesma AST que gera a tabela, então os dois painéis
 * nunca discordam — e escolher uma linha da tabela acende o caminho da
 * eletricidade no diagrama.
 */
export function CircuitView({ ast, notation, assignment }: CircuitViewProps) {
  const graph = useMemo(() => astToGraph(ast, notation), [ast, notation])

  /**
   * O `fitView` do React Flow só roda na montagem. Sem remontar, trocar de
   * expressão mantinha o enquadramento antigo e circuitos maiores apareciam
   * cortados na direita. A chave muda quando o desenho muda — e só então,
   * para acender uma linha da tabela não jogar fora o zoom do usuário.
   */
  const graphKey = useMemo(
    () => graph.nodes.map((node) => `${node.id}:${node.data.label}`).join('|'),
    [graph],
  )

  const { nodes, edges } = useMemo(() => {
    const signals = assignment ? computeSignals(graph, assignment) : null

    const laidOut = layoutGraph(graph.nodes, graph.edges).map((node) => ({
      ...node,
      data: { ...node.data, value: signals?.[node.id] },
    }))

    const wired = graph.edges.map((edge) => {
      const live = signals?.[edge.source] === true
      return {
        ...edge,
        animated: live,
        style: {
          stroke: live ? '#f59e0b' : 'var(--color-slate-400)',
          strokeWidth: live ? 2.4 : 1.6,
        },
      }
    })

    return { nodes: laidOut, edges: wired }
  }, [graph, assignment])

  return (
    <div className="h-96 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
      <ReactFlow
        key={graphKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
