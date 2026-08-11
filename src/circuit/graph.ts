import type { Edge, Node } from '@xyflow/react'
import type { AstNode, BinaryOp } from '../engine'
import { evaluate, formatAst, type Assignment, type Notation } from '../engine'

export type GateOp = BinaryOp | 'not'

export type CircuitNodeKind = 'input' | 'constant' | 'gate' | 'output'

export interface CircuitNodeData extends Record<string, unknown> {
  kind: CircuitNodeKind
  label: string
  op?: GateOp
  /** Quantas entradas o bloco recebe (1 para NOT e saída, 2 para o resto). */
  inputs: number
  value?: boolean
}

export type CircuitNode = Node<CircuitNodeData>

export interface CircuitGraph {
  nodes: CircuitNode[]
  edges: Edge[]
  /** Qual subexpressão cada nó representa — usado para acender os fios. */
  sources: Map<string, AstNode>
}

/**
 * Converte a árvore de sintaxe em um grafo de portas lógicas.
 *
 * Variáveis repetidas viram um único nó de entrada com vários fios saindo
 * dele, que é como o circuito seria montado de verdade.
 */
export function astToGraph(ast: AstNode, notation: Notation = 'math'): CircuitGraph {
  const nodes: CircuitNode[] = []
  const edges: Edge[] = []
  const sources = new Map<string, AstNode>()
  const inputIds = new Map<string, string>()
  /** Subexpressão já construída → nó que a produz. */
  const built = new Map<string, string>()
  let counter = 0

  const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`

  const addNode = (
    id: string,
    data: CircuitNodeData,
    source: AstNode,
  ): string => {
    nodes.push({ id, type: 'logic', position: { x: 0, y: 0 }, data })
    sources.set(id, source)
    return id
  }

  const visit = (node: AstNode): string => {
    // Um circuito real não constrói o mesmo ¬A três vezes: um inversor só
    // alimenta todas as portas que precisam dele. Reaproveitar subexpressões
    // idênticas corta portas e desembaraça os fios.
    const form = formatAst(node, 'math')
    const existing = built.get(form)
    if (existing) return existing
    const id = build(node)
    built.set(form, id)
    return id
  }

  const build = (node: AstNode): string => {
    switch (node.kind) {
      case 'var': {
        const existing = inputIds.get(node.name)
        if (existing) return existing
        const id = addNode(
          nextId('in'),
          { kind: 'input', label: node.name, inputs: 0 },
          node,
        )
        inputIds.set(node.name, id)
        return id
      }
      case 'const': {
        return addNode(
          nextId('const'),
          { kind: 'constant', label: node.value ? '1' : '0', inputs: 0 },
          node,
        )
      }
      case 'not': {
        const operand = visit(node.operand)
        const id = addNode(
          nextId('gate'),
          { kind: 'gate', label: 'NOT', op: 'not', inputs: 1 },
          node,
        )
        edges.push(connect(operand, id, 'a'))
        return id
      }
      case 'binary': {
        const left = visit(node.left)
        const right = visit(node.right)
        const id = addNode(
          nextId('gate'),
          {
            kind: 'gate',
            label: GATE_LABELS[node.op],
            op: node.op,
            inputs: 2,
          },
          node,
        )
        edges.push(connect(left, id, 'a'))
        edges.push(connect(right, id, 'b'))
        return id
      }
    }
  }

  const rootId = visit(ast)
  const outputId = addNode(
    nextId('out'),
    { kind: 'output', label: formatAst(ast, notation), inputs: 1 },
    ast,
  )
  edges.push(connect(rootId, outputId, 'a'))

  return { nodes, edges, sources }
}

function connect(source: string, target: string, handle: 'a' | 'b'): Edge {
  return {
    id: `${source}->${target}:${handle}`,
    source,
    target,
    targetHandle: handle,
    type: 'smoothstep',
  }
}

export const GATE_LABELS: Record<GateOp, string> = {
  not: 'NOT',
  and: 'AND',
  nand: 'NAND',
  or: 'OR',
  nor: 'NOR',
  xor: 'XOR',
  xnor: 'XNOR',
  implies: 'IMPL',
  iff: 'EQUIV',
}

/** Valor lógico de cada nó para uma linha da tabela. */
export function computeSignals(
  graph: CircuitGraph,
  assignment: Assignment,
): Record<string, boolean> {
  const signals: Record<string, boolean> = {}
  for (const [id, source] of graph.sources) {
    signals[id] = evaluate(source, assignment)
  }
  return signals
}
