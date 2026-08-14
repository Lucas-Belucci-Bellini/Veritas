import { useCallback, useMemo, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  editorInputCount,
  evaluateCircuit,
  validateCircuit,
  type CircuitDocument,
  type CircuitNode,
  type EditorComponentType,
} from '../circuit'
import { GateSymbol } from '../circuit/GateSymbol'
import type { GateOp } from '../circuit/graph'

interface EditorNodeData extends Record<string, unknown> {
  kind: 'input' | 'constant' | 'gate' | 'output'
  componentType: EditorComponentType
  label: string
  inputs: number
  op?: GateOp
  value?: boolean
}

type EditorFlowNode = Node<EditorNodeData>

const NODE_TYPES: NodeTypes = { editorLogic: EditorLogicNode }

const PALETTE: readonly { type: EditorComponentType; label: string; description: string }[] = [
  { type: 'input', label: 'Entrada', description: 'Pino externo' },
  { type: 'constant', label: 'Constante', description: '0 ou 1' },
  { type: 'and', label: 'AND', description: 'E lógico' },
  { type: 'or', label: 'OR', description: 'OU lógico' },
  { type: 'not', label: 'NOT', description: 'Inversor' },
  { type: 'xor', label: 'XOR', description: 'OU exclusivo' },
  { type: 'output', label: 'Saída', description: 'Pino observável' },
]

const NODE_LABELS: Record<EditorComponentType, string> = {
  input: 'Entrada',
  constant: 'Constante',
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  xor: 'XOR',
  output: 'Saída',
}

export function CircuitEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorFlowNode>(createDemoNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [notice, setNotice] = useState('')
  const [showGuide, setShowGuide] = useState(true)

  const document = useMemo(() => toDocument(nodes, edges), [nodes, edges])
  const issues = useMemo(() => validateCircuit(document), [document])
  const evaluation = useMemo(() => {
    if (issues.length > 0) return null
    try {
      return evaluateCircuit(document)
    } catch {
      return null
    }
  }, [document, issues])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const targetHandle = connection.targetHandle ?? 'a'
      const alreadyConnected = edges.some(
        (edge) => edge.target === connection.target && (edge.targetHandle ?? 'a') === targetHandle,
      )
      if (alreadyConnected) {
        setNotice('Essa entrada já possui uma conexão. Remova o fio antigo antes de conectar outro.')
        return
      }
      setNotice('')
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `${connection.source}->${connection.target}:${targetHandle}`,
            targetHandle,
            type: 'smoothstep',
          },
          current,
        ),
      )
    },
    [edges, setEdges],
  )

  const addComponent = (type: EditorComponentType) => {
    setNotice('')
    setNodes((current) => [...current, createNode(type, current.length)])
  }

  const reset = () => {
    setNodes(createDemoNodes())
    setEdges(createDemoEdges())
    setNotice('Exemplo de AND carregado.')
  }

  const validationMessage =
    issues[0]?.message ??
    (evaluation
      ? `Circuito válido: ${Object.keys(evaluation.outputs).length} saída(s) avaliada(s).`
      : 'Adicione componentes e conecte as entradas para começar.')

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-300">
            v0.7.0 · prévia
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            Editor visual combinacional
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Monte um circuito no canvas, conecte as portas e valide a lógica sem precisar começar por uma expressão.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="key text-xs" onClick={reset}>
            Carregar exemplo
          </button>
          <button
            type="button"
            className="key text-xs"
            onClick={() => setShowGuide((visible) => !visible)}
            aria-expanded={showGuide}
          >
            {showGuide ? 'Ocultar tutorial' : 'Como usar'}
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900 dark:border-brand-900/70 dark:bg-brand-950/40 dark:text-brand-100">
          <strong>Como usar:</strong> adicione componentes na paleta, arraste os pontos de saída para as entradas e use a mensagem abaixo do canvas para corrigir conexões incompletas.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
            Componentes
          </h3>
          <div className="grid gap-2">
            {PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-500 dark:hover:bg-brand-950/40"
                onClick={() => addComponent(item.type)}
                title={item.description}
              >
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {item.label}
                </span>
                <span className="block text-[11px] text-slate-400">{item.description}</span>
              </button>
            ))}
          </div>
        </aside>

        <div>
          <div className="h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              deleteKeyCode={['Backspace', 'Delete']}
              nodesConnectable
              nodesDraggable
              elementsSelectable
              minZoom={0.25}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
              <Controls />
            </ReactFlow>
          </div>
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              issues.length === 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200'
            }`}
            role="status"
          >
            {notice || validationMessage}
          </div>
        </div>
      </div>

      {evaluation && Object.keys(evaluation.outputs).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {Object.entries(evaluation.outputs).map(([id, value]) => (
            <span
              key={id}
              className="rounded-full border border-slate-200 px-3 py-1 font-mono dark:border-slate-700"
            >
              {labelForNode(nodes, id)} = {value ? '1' : '0'}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function EditorLogicNode({ data }: NodeProps<EditorFlowNode>) {
  const lit = data.value === true
  const dot = `!h-1.5 !w-1.5 !border-0 ${lit ? '!bg-amber-500' : '!bg-slate-400 dark:!bg-slate-500'}`

  if (data.kind === 'input' || data.kind === 'constant') {
    return (
      <div className="flex items-center" style={{ height: 32 }}>
        <span className="grid h-8 min-w-8 place-items-center rounded-full border-2 border-slate-400 bg-white px-2 font-mono text-sm font-bold text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
          {data.label}
        </span>
        <span className="h-0.5 w-4 bg-slate-400 dark:bg-slate-500" />
        <Handle type="source" position={Position.Right} className={dot} />
      </div>
    )
  }

  if (data.kind === 'output') {
    return (
      <div className="flex items-center gap-2" title={data.label} style={{ height: 40 }}>
        <Handle type="target" position={Position.Left} id="a" className={dot} />
        <span className="h-0.5 w-4 bg-slate-400 dark:bg-slate-500" />
        <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-400 dark:border-slate-500" />
        <span className="expr font-mono text-xs font-semibold whitespace-nowrap">{data.label}</span>
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: 72, height: 56 }} title={data.label}>
      <GateSymbol op={data.op ?? 'and'} lit={lit} />
      {data.inputs === 2 ? (
        <>
          <Handle type="target" position={Position.Left} id="a" style={{ top: 18 }} className={dot} />
          <Handle type="target" position={Position.Left} id="b" style={{ top: 38 }} className={dot} />
        </>
      ) : (
        <Handle type="target" position={Position.Left} id="a" className={dot} />
      )}
      <Handle type="source" position={Position.Right} className={dot} />
    </div>
  )
}

function toDocument(nodes: EditorFlowNode[], edges: Edge[]): CircuitDocument {
  const editorNodes: CircuitNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.data.componentType,
    position: node.position,
    label: node.data.label,
    options: node.data.componentType === 'constant' ? { value: node.data.value ?? false } : undefined,
  }))

  return {
    format: 'veritas-circuit',
    version: 1,
    name: 'Circuito visual',
    nodes: editorNodes,
    connections: edges.flatMap((edge) => {
      if (!edge.source || !edge.target) return []
      return [
        {
          source: { node: edge.source },
          target: { node: edge.target, port: edge.targetHandle === 'b' ? 1 : 0 },
        },
      ]
    }),
  }
}

function createNode(type: EditorComponentType, index: number): EditorFlowNode {
  const kind = type === 'input' || type === 'constant' ? type : type === 'output' ? 'output' : 'gate'
  const defaultValue = type === 'constant'
  const label = type === 'input' ? `I${index + 1}` : type === 'output' ? `O${index + 1}` : NODE_LABELS[type]

  return {
    id: `${type}-${index + 1}`,
    type: 'editorLogic',
    position: { x: 40 + (index % 3) * 150, y: 40 + Math.floor(index / 3) * 100 },
    data: {
      kind,
      componentType: type,
      label,
      inputs: editorInputCount(type),
      op: type === 'not' ? 'not' : type === 'and' || type === 'or' || type === 'xor' ? type : undefined,
      value: defaultValue,
    },
  }
}

function createDemoNodes(): EditorFlowNode[] {
  return [
    createNode('input', 0),
    createNode('input', 1),
    { ...createNode('and', 2), position: { x: 220, y: 70 } },
    { ...createNode('output', 3), position: { x: 400, y: 70 } },
  ]
}

function createDemoEdges(): Edge[] {
  return [
    { id: 'input-1->and-3:a', source: 'input-1', target: 'and-3', targetHandle: 'a', type: 'smoothstep' },
    { id: 'input-2->and-3:b', source: 'input-2', target: 'and-3', targetHandle: 'b', type: 'smoothstep' },
    { id: 'and-3->output-4:a', source: 'and-3', target: 'output-4', targetHandle: 'a', type: 'smoothstep' },
  ]
}

function labelForNode(nodes: EditorFlowNode[], id: string): string {
  return nodes.find((node) => node.id === id)?.data.label ?? id
}

