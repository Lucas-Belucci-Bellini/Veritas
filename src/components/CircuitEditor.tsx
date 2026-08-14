import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import { assignmentAt } from '../engine'
import {
  buildCircuitTruthTable,
  editorInputCount,
  evaluateCircuit,
  exportCircuit,
  validateCircuit,
  type CircuitDocument,
  type CircuitNode,
  type EditorComponentType,
} from '../circuit'
import { GateSymbol } from '../circuit/GateSymbol'
import type { GateOp } from '../circuit/graph'
import { TruthTableView } from './TruthTableView'
import { useCircuitProjects } from '../hooks/useCircuitProjects'
import type { ValueStyle } from '../lib/values'
import type { CircuitProject } from '../storage/db'
import { useAuth } from '../auth/useAuth'
import { useCloudCircuitProjects } from '../hooks/useCloudCircuitProjects'
import { requestCircuitAi, type CircuitAiResult } from '../ai/circuitAi'
import { CircuitVersionHistory } from './CircuitVersionHistory'
import { useCircuitCollaboration } from '../hooks/useCircuitCollaboration'
import { AiMetricsPanel } from './AiMetricsPanel'
import { addCircuitCollaborator, listCircuitCollaborators, removeCircuitCollaborator, type CircuitCollaborator, type CollaboratorRole } from '../realtime/circuitCollaborators'

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
  const [edges, setEdges, onEdgesChange] = useEdgesState(createDemoEdges())
  const [notice, setNotice] = useState('')
  const [showGuide, setShowGuide] = useState(true)
  const [projectName, setProjectName] = useState('Circuito AND')
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null)
  const [selectedOutputId, setSelectedOutputId] = useState<string | undefined>()
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [valueStyle, setValueStyle] = useState<ValueStyle>('vf')
  const [hydrated, setHydrated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const storage = useCircuitProjects()
  const { user } = useAuth()
  const cloud = useCloudCircuitProjects()
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<CircuitAiResult | null>(null)
  const [collaborators, setCollaborators] = useState<CircuitCollaborator[]>([])
  const [collaboratorUserId, setCollaboratorUserId] = useState('')
  const [collaboratorRole, setCollaboratorRole] = useState<CollaboratorRole>('editor')

  const document = useMemo(() => toDocument(nodes, edges), [nodes, edges])
  const applyRemoteDocument = useCallback((remoteDocument: CircuitDocument) => {
    if (validateCircuit(remoteDocument).length > 0) return
    const flow = fromDocument(remoteDocument)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setProjectName(remoteDocument.name)
    setSelectedRow(null)
    setNotice('Alteração remota recebida de outro colaborador.')
  }, [setEdges, setNodes])
  const collaboration = useCircuitCollaboration({
    projectId: cloudProjectId,
    enabled: Boolean(user && cloudProjectId),
    onRemoteDocument: applyRemoteDocument,
  })
  const issues = useMemo(() => validateCircuit(document), [document])
  const outputNodes = useMemo(
    () => nodes.filter((node) => node.data.componentType === 'output'),
    [nodes],
  )

  useEffect(() => {
    if (!user || !cloudProjectId) {
      setCollaborators([])
      return
    }
    let active = true
    void listCircuitCollaborators(cloudProjectId).then((items) => {
      if (active) setCollaborators(items)
    }).catch(() => {
      if (active) setCollaborators([])
    })
    return () => { active = false }
  }, [cloudProjectId, user])

  useEffect(() => {
    if (selectedOutputId && outputNodes.some((node) => node.id === selectedOutputId)) return
    setSelectedOutputId(outputNodes[0]?.id)
  }, [outputNodes, selectedOutputId])

  useEffect(() => {
    if (!storage.ready || hydrated) return
    const latest = storage.projects[0]
    if (latest) {
      loadProject(latest, setNodes, setEdges, setProjectName, setActiveProjectId)
      setNotice(`Circuito local "${latest.name}" restaurado.`)
    }
    setHydrated(true)
  }, [hydrated, setEdges, setNodes, storage.projects, storage.ready])

  const truthTable = useMemo(() => {
    if (issues.length > 0) return null
    try {
      return buildCircuitTruthTable(document, { outputId: selectedOutputId })
    } catch {
      return null
    }
  }, [document, issues, selectedOutputId])

  const selectedEvaluation = useMemo(() => {
    if (!truthTable || selectedRow === null) return null
    try {
      return evaluateCircuit(document, assignmentAt(truthTable, selectedRow))
    } catch {
      return null
    }
  }, [document, selectedRow, truthTable])

  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          value: selectedEvaluation?.values[node.id]?.[0],
        },
      })),
    [nodes, selectedEvaluation],
  )

  const { broadcast: broadcastRemote, status: collaborationStatus } = collaboration
  const readOnlyCollaboration = Boolean(user && collaborators.some((collaborator) => collaborator.userId === user.id && collaborator.role === 'viewer'))

  useEffect(() => {
    if (collaborationStatus !== 'connected') return
    const timer = setTimeout(() => {
      void broadcastRemote(document)
    }, 120)
    return () => clearTimeout(timer)
  }, [broadcastRemote, collaborationStatus, document])

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const live = selectedEvaluation?.values[edge.source]?.[0] === true
        return {
          ...edge,
          animated: live,
          style: {
            stroke: live ? '#f59e0b' : 'var(--color-slate-400)',
            strokeWidth: live ? 2.4 : 1.6,
          },
        }
      }),
    [edges, selectedEvaluation],
  )

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
      setSelectedRow(null)
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
    if (readOnlyCollaboration) {
      setNotice('Você está conectado como visualizador e não pode editar este circuito.')
      return
    }
    setNotice('')
    setSelectedRow(null)
    setNodes((current) => [...current, createNode(type, current.length, nextNodeId(type, current))])
  }

  const reset = () => {
    setNodes(createDemoNodes())
    setEdges(createDemoEdges())
    setProjectName('Circuito AND')
    setActiveProjectId(null)
    setSelectedRow(null)
    setNotice('Exemplo de AND carregado. Salve-o localmente quando quiser preservá-lo.')
  }

  const saveLocal = async () => {
    if (storage.unavailable) {
      setNotice(storage.unavailable)
      return
    }
    try {
      const name = projectName.trim() || document.name
      const documentToSave = { ...document, name }
      if (activeProjectId !== null) {
        await storage.update(activeProjectId, { name, document: documentToSave })
      } else {
        const id = await storage.save({ name, document: documentToSave })
        setActiveProjectId(id)
      }
      setProjectName(name)
      setNotice(`Circuito "${name}" salvo no IndexedDB.`)
    } catch {
      setNotice('Não foi possível salvar o circuito localmente.')
    }
  }

  const openLocal = (project: CircuitProject) => {
    loadProject(project, setNodes, setEdges, setProjectName, setActiveProjectId)
    setSelectedRow(null)
    setNotice(`Circuito local "${project.name}" aberto.`)
  }

  const removeLocal = async (project: CircuitProject) => {
    try {
      await storage.remove(project.id)
      if (activeProjectId === project.id) {
        setActiveProjectId(null)
        setNotice('Circuito removido do armazenamento local.')
      }
    } catch {
      setNotice('Não foi possível remover o circuito local.')
    }
  }

  const downloadIndustrialExport = (format: 'verilog' | 'vhdl') => {
    try {
      const content = exportCircuit(document, format)
      const extension = format === 'verilog' ? 'v' : 'vhd'
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `${safeFileName(projectName || document.name)}.${extension}`
      link.click()
      URL.revokeObjectURL(url)
      setNotice(`Exportação ${format === 'verilog' ? 'Verilog' : 'VHDL'} concluída.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível exportar o circuito.')
    }
  }

  const exportLocal = () => {
    const blob = new Blob([JSON.stringify({ format: 'veritas-circuits', version: 1, exportedAt: new Date().toISOString(), projects: [{ name: projectName, document }] }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = `${safeFileName(projectName || 'circuito')}.veritas-circuits.json`
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Arquivo de circuito exportado.')
  }

  const runAi = async (action: 'analyze' | 'optimize') => {
    if (!user) {
      setNotice('Entre na sua conta para usar a análise de IA.')
      return
    }
    if (issues.length > 0) {
      setNotice('Corrija o circuito antes de pedir uma análise de IA.')
      return
    }
    setAiLoading(true)
    setAiResult(null)
    try {
      setAiResult(await requestCircuitAi(document, action))
      setNotice(action === 'analyze' ? 'Análise de IA concluída.' : 'Otimização de IA concluída; revise antes de aplicar.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível concluir a análise de IA.')
    } finally {
      setAiLoading(false)
    }
  }

  const applyAiOptimization = () => {
    const optimized = aiResult?.optimizedDocument
    if (!optimized) return
    const flow = fromDocument(optimized)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setProjectName(optimized.name)
    setCloudProjectId(null)
    setSelectedRow(null)
    setNotice('Otimização aplicada localmente. Sincronize novamente se quiser enviá-la para a nuvem.')
  }

  const syncCloud = async () => {
    if (readOnlyCollaboration) {
      setNotice('Visualizadores não podem sincronizar alterações na nuvem.')
      return
    }
    if (!user) {
      setNotice('Entre na sua conta para sincronizar circuitos na nuvem.')
      return
    }
    try {
      const name = projectName.trim() || document.name
      const result = await cloud.sync(name, { ...document, name }, cloudProjectId ?? undefined)
      setCloudProjectId(result.project.id)
      setProjectName(result.project.name)
      setNotice(`Circuito "${result.project.name}" sincronizado na nuvem na versão ${result.version.versionNumber}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível sincronizar o circuito.')
    }
  }

  const openCloud = (project: (typeof cloud.projects)[number]) => {
    const flow = fromDocument(project.document)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setProjectName(project.name)
    setCloudProjectId(project.id)
    setActiveProjectId(null)
    setSelectedRow(null)
    void cloud.loadVersions(project.id)
    setNotice(`Circuito da nuvem "${project.name}" aberto.`)
  }

  const openCloudVersion = (version: (typeof cloud.versions)[number]) => {
    const flow = fromDocument(version.document)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setProjectName(version.name)
    setSelectedRow(null)
    setNotice(`Versão ${version.versionNumber} aberta como prévia. Sincronize para criar uma nova versão.`)
  }

  const inviteCollaborator = async () => {
    if (!cloudProjectId || !collaboratorUserId.trim()) return
    try {
      const collaborator = await addCircuitCollaborator(cloudProjectId, collaboratorUserId, collaboratorRole)
      setCollaborators((current) => [...current.filter((item) => item.userId !== collaborator.userId), collaborator])
      setCollaboratorUserId('')
      setNotice('Colaborador adicionado ao circuito.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível adicionar o colaborador.')
    }
  }

  const removeCollaborator = async (collaborator: CircuitCollaborator) => {
    if (!cloudProjectId) return
    try {
      await removeCircuitCollaborator(cloudProjectId, collaborator.userId)
      setCollaborators((current) => current.filter((item) => item.userId !== collaborator.userId))
      setNotice('Colaborador removido do circuito.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível remover o colaborador.')
    }
  }

  const removeCloud = async (project: (typeof cloud.projects)[number]) => {
    try {
      await cloud.remove(project.id)
      if (cloudProjectId === project.id) setCloudProjectId(null)
      setNotice('Circuito removido da nuvem.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível remover o circuito da nuvem.')
    }
  }

  const importLocal = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const count = await storage.importFile(await file.text())
      setNotice(`${count} circuito(s) importado(s) para o IndexedDB.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Arquivo de circuito inválido.')
    }
  }

  const validationMessage =
    issues[0]?.message ??
    (truthTable
      ? `Circuito válido: ${truthTable.variables.length} entrada(s), ${truthTable.totalRows} linha(s).`
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
        <div className="flex flex-wrap gap-2">
          <button type="button" className="key text-xs" onClick={reset}>
            Novo exemplo
          </button>
          <button type="button" className="key text-xs" onClick={saveLocal}>
            Salvar local
          </button>
          <button type="button" className="key text-xs" onClick={() => void syncCloud()} disabled={cloud.loading || readOnlyCollaboration} title={user ? 'Sincronizar este circuito com sua conta Supabase' : 'Entre para sincronizar na nuvem'}>
            {cloud.loading ? 'Sincronizando…' : 'Sincronizar nuvem'}
          </button>
          <button type="button" className="key text-xs" onClick={exportLocal}>
            Exportar
          </button>
          <button type="button" className="key text-xs" onClick={() => downloadIndustrialExport('verilog')} disabled={issues.length > 0}>
            Verilog
          </button>
          <button type="button" className="key text-xs" onClick={() => downloadIndustrialExport('vhdl')} disabled={issues.length > 0}>
            VHDL
          </button>
          <button type="button" className="key text-xs" onClick={() => fileInputRef.current?.click()}>
            Importar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json,.veritas-circuits.json"
            className="hidden"
            onChange={importLocal}
          />
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
          <strong>Como usar:</strong> adicione componentes na paleta, arraste os pontos de saída para as entradas, clique em uma linha da tabela para acender o circuito e use “Salvar local” para guardar o desenho no navegador.
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
                disabled={readOnlyCollaboration}
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
              nodes={renderedNodes}
              edges={renderedEdges}
              nodeTypes={NODE_TYPES}
              onNodesChange={readOnlyCollaboration ? undefined : onNodesChange}
              onEdgesChange={readOnlyCollaboration ? undefined : onEdgesChange}
              onConnect={readOnlyCollaboration ? undefined : onConnect}
              nodesDraggable={!readOnlyCollaboration}
              nodesConnectable={!readOnlyCollaboration}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              deleteKeyCode={['Backspace', 'Delete']}
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500" htmlFor="circuit-project-name">
          Projeto local
        </label>
        <input
          id="circuit-project-name"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          className="min-w-48 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-700"
          placeholder="Nome do circuito"
        />
        {storage.unavailable && <span className="text-xs text-amber-700 dark:text-amber-300">{storage.unavailable}</span>}
        {storage.error && <span className="text-xs text-rose-700 dark:text-rose-300">{storage.error}</span>}
      </div>

      {user && cloud.projects.length > 0 && (
        <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900/70 dark:bg-brand-950/20">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-300">Circuitos na nuvem</span>
            <button type="button" className="text-xs text-brand-700 hover:underline dark:text-brand-300" onClick={() => void cloud.refresh()}>Atualizar</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cloud.projects.map((project) => (
              <div key={project.id} className="flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2 py-1 dark:border-brand-800 dark:bg-slate-900">
                <button type="button" className="px-2 text-xs font-semibold hover:text-brand-600" onClick={() => openCloud(project)}>{project.name}</button>
                <button type="button" className="px-1 text-xs text-slate-400 hover:text-rose-600" onClick={() => void removeCloud(project)} aria-label={`Excluir ${project.name} da nuvem`}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {cloud.error && user && <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{cloud.error}</p>}
      {user && cloudProjectId && collaboration.status !== 'disabled' && (
        <div className={`mt-3 rounded-xl border p-3 text-xs ${collaboration.status === 'connected' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200' : collaboration.status === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/20 dark:text-rose-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{collaboration.status === 'connected' ? 'Colaboração em tempo real ativa' : collaboration.status === 'connecting' ? 'Conectando colaboração…' : 'Colaboração indisponível'}</strong>
            {collaboration.participants.length > 0 && <span>{collaboration.participants.length} participante(s) online</span>}
          </div>
          {collaboration.error && <p className="mt-1">{collaboration.error}</p>}
          {collaboration.participants.length > 0 && <p className="mt-1 opacity-80">{collaboration.participants.map((participant) => participant.label).join(' · ')}</p>}
        </div>
      )}

      {user && cloudProjectId && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Acesso ao circuito</span>
            <span className="text-[11px] text-slate-400">Compartilhe usando o UUID do usuário</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={collaboratorUserId} onChange={(event) => setCollaboratorUserId(event.target.value)} className="min-w-64 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" placeholder="UUID do usuário" />
            <select value={collaboratorRole} onChange={(event) => setCollaboratorRole(event.target.value as CollaboratorRole)} className="rounded-lg border border-slate-200 bg-transparent px-2 py-2 text-xs dark:border-slate-700"><option value="editor">Editor</option><option value="viewer">Visualizador</option></select>
            <button type="button" className="key text-xs" onClick={() => void inviteCollaborator()} disabled={!collaboratorUserId.trim()}>Adicionar</button>
          </div>
          {collaborators.length > 0 && <div className="mt-2 grid gap-1">{collaborators.map((collaborator) => <div key={collaborator.userId} className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300"><span className="truncate">{collaborator.userId} · {collaborator.role === 'editor' ? 'editor' : 'visualizador'}</span><button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => void removeCollaborator(collaborator)} aria-label={`Remover ${collaborator.userId}`}>×</button></div>)}</div>}
        </div>
      )}

      {user && cloudProjectId && (cloud.versions.length > 0 || cloud.versionsLoading) && (
        <CircuitVersionHistory
          versions={cloud.versions}
          loading={cloud.versionsLoading}
          onRefresh={() => void cloud.loadVersions(cloudProjectId)}
          onOpenVersion={openCloudVersion}
        />
      )}

      {user && issues.length === 0 && (
        <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/70 dark:bg-violet-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-violet-700 uppercase dark:text-violet-300">Assistente de lógica</h3>
              <p className="mt-1 text-xs text-violet-800/80 dark:text-violet-200/80">Analisa o contexto do circuito e propõe uma limpeza conservadora das portas.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="key text-xs" disabled={aiLoading} onClick={() => void runAi('analyze')}>{aiLoading ? 'Analisando…' : 'Analisar com IA'}</button>
              <button type="button" className="key text-xs" disabled={aiLoading} onClick={() => void runAi('optimize')}>{aiLoading ? 'Otimizando…' : 'Otimizar portas'}</button>
            </div>
          </div>
          {aiResult && (
            <div className="mt-3 rounded-lg border border-violet-200 bg-white/70 p-3 text-sm dark:border-violet-900/70 dark:bg-slate-900/60">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{aiResult.summary}</p>
              <p className="mt-1 text-xs text-slate-400">Provedor: {aiResult.provider === 'llm' ? 'modelo de linguagem' : 'heurística segura'} · confiança {Math.round(aiResult.confidence * 100)}%</p>
              <ul className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">{aiResult.suggestions.map((suggestion) => <li key={suggestion}>• {suggestion}</li>)}</ul>
              {aiResult.optimizedDocument && <button type="button" className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700" onClick={applyAiOptimization}>Aplicar otimização</button>}
            </div>
          )}
        </section>
      )}

      {user && <AiMetricsPanel />}

      {storage.projects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {storage.projects.map((project) => (
            <div key={project.id} className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
              <button type="button" className="px-2 text-xs font-semibold hover:text-brand-600" onClick={() => openLocal(project)}>
                {project.name}
              </button>
              <button type="button" className="px-1 text-xs text-slate-400 hover:text-rose-600" onClick={() => void removeLocal(project)} aria-label={`Excluir ${project.name}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {truthTable && (
        <section className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                Tabela verdade do circuito
              </h3>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                A tabela é calculada automaticamente a partir das entradas e saídas conectadas no canvas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {outputNodes.length > 1 && (
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  Saída
                  <select
                    value={selectedOutputId ?? ''}
                    onChange={(event) => {
                      setSelectedOutputId(event.target.value)
                      setSelectedRow(null)
                    }}
                    className="rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 dark:border-slate-700"
                  >
                    {outputNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.data.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" className="key text-xs" onClick={() => setValueStyle((style) => (style === 'vf' ? 'binary' : 'vf'))}>
                {valueStyle === 'vf' ? 'V / F' : '1 / 0'}
              </button>
            </div>
          </div>
          <TruthTableView table={truthTable} style={valueStyle} selectedRow={selectedRow} onSelectRow={setSelectedRow} />
        </section>
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
        <span className={`grid h-8 min-w-8 place-items-center rounded-full border-2 px-2 font-mono text-sm font-bold transition-colors ${lit ? 'border-amber-500 bg-amber-400/25 text-amber-700 dark:text-amber-200' : 'border-slate-400 bg-white text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'}`}>
          {data.label}
        </span>
        <span className={`h-0.5 w-4 ${lit ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
        <Handle type="source" position={Position.Right} className={dot} />
      </div>
    )
  }

  if (data.kind === 'output') {
    return (
      <div className="flex items-center gap-2" title={data.label} style={{ height: 40 }}>
        <Handle type="target" position={Position.Left} id="a" className={dot} />
        <span className={`h-0.5 w-4 ${lit ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
        <span className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${lit ? 'border-amber-500 bg-amber-400 shadow-[0_0_12px_2px_rgb(245_158_11/0.6)]' : 'border-slate-400 dark:border-slate-500'}`} />
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

function createNode(type: EditorComponentType, index: number, id = `${type}-${index + 1}`): EditorFlowNode {
  const kind = type === 'input' || type === 'constant' ? type : type === 'output' ? 'output' : 'gate'
  const defaultValue = type === 'constant'
  const label = type === 'input' ? `I${index + 1}` : type === 'output' ? `O${index + 1}` : NODE_LABELS[type]

  return {
    id,
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

function nextNodeId(type: EditorComponentType, nodes: EditorFlowNode[]): string {
  let index = nodes.length + 1
  let id = `${type}-${index}`
  while (nodes.some((node) => node.id === id)) {
    index += 1
    id = `${type}-${index}`
  }
  return id
}

function fromDocument(document: CircuitDocument): { nodes: EditorFlowNode[]; edges: Edge[] } {
  return {
    nodes: document.nodes.map((node, index) =>
      createNode(node.type, index, node.id),
    ).map((node, index) => {
      const source = document.nodes[index]
      return {
        ...node,
        position: source.position,
        data: {
          ...node.data,
          label: source.label ?? node.data.label,
          value: source.options?.value ?? source.options?.initial ?? node.data.value,
        },
      }
    }),
    edges: document.connections.map((connection) => ({
      id: `${connection.source.node}->${connection.target.node}:${connection.target.port === 1 ? 'b' : 'a'}`,
      source: connection.source.node,
      target: connection.target.node,
      targetHandle: connection.target.port === 1 ? 'b' : 'a',
      type: 'smoothstep',
    })),
  }
}

function loadProject(
  project: CircuitProject,
  setNodes: (nodes: EditorFlowNode[]) => void,
  setEdges: (edges: Edge[]) => void,
  setProjectName: (name: string) => void,
  setActiveProjectId: (id: number | null) => void,
): void {
  const flow = fromDocument(project.document)
  setNodes(flow.nodes)
  setEdges(flow.edges)
  setProjectName(project.name)
  setActiveProjectId(project.id)
}

function safeFileName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'circuito'
}
