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
  buildCircuitVectorTruthTable,
  editorInputCount,
  evaluateCircuit,
  evaluateCircuitVectors,
  exportCircuit,
  validateCircuit,
  type CircuitDocument,
  type CircuitEvaluation,
  type CircuitNode,
  type CircuitVectorEvaluation,
  type CircuitVectorTruthTable,
  type EditorComponentType,
} from '../circuit'
import { GateSymbol } from '../circuit/GateSymbol'
import type { GateOp } from '../circuit/graph'
import { CircuitHistory } from '../circuit/history'
import { parseBusLiteral, toBinary, type BitVector } from '../bus'
import { TruthTableView } from './TruthTableView'
import { VectorTruthTableView } from './VectorTruthTableView'
import { useCircuitProjects } from '../hooks/useCircuitProjects'
import type { ValueStyle } from '../lib/values'
import type { CircuitProject } from '../storage/db'
import { useAuth } from '../auth/useAuth'
import { useCloudCircuitProjects } from '../hooks/useCloudCircuitProjects'
import { requestCircuitAi, type CircuitAiResult } from '../ai/circuitAi'
import { CircuitVersionHistory } from './CircuitVersionHistory'
import { AccessibleTooltip } from './AccessibleTooltip'
import { useCircuitCollaboration } from '../hooks/useCircuitCollaboration'
import type { CircuitBroadcast } from '../realtime/circuitCollaboration'
import { AiMetricsPanel } from './AiMetricsPanel'
import { SequentialCircuitPanel } from './SequentialCircuitPanel'
import type { DocumentRuntimeSnapshot, DocumentRuntimeState } from '../simulation/documentRuntime'
import { runtimeFreshness } from '../realtime/runtimeFreshness'
import { EMPTY_RUNTIME_METRICS, recordRuntimeMetric, type RuntimeMetricEvent, type RuntimeMetrics } from '../realtime/runtimeMetrics'
import { addCircuitCollaborator, listCircuitCollaborators, removeCircuitCollaborator, type CircuitCollaborator, type CollaboratorRole } from '../realtime/circuitCollaborators'
import { createCircuitRoom, listCircuitRooms, type CircuitRoom } from '../realtime/circuitRooms'
import { buildCircuitIssueGuidance, summarizeCircuitIssues } from '../circuit/validationFeedback'

interface EditorNodeData extends Record<string, unknown> {
  kind: 'input' | 'constant' | 'gate' | 'output' | 'sequential'
  componentType: EditorComponentType
  label: string
  inputs: number
  width: number
  op?: GateOp
  value?: boolean
  busValue?: string
  period?: number
  ticks?: number
  initial?: boolean
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
  { type: 'clock', label: 'Clock', description: 'Relógio sequencial' },
  { type: 'dff', label: 'DFF', description: 'Flip-flop D · D/CLK → Q' },
  { type: 'tff', label: 'TFF', description: 'Flip-flop T · T/CLK → Q' },
  { type: 'delay', label: 'Delay', description: 'Atraso de N tiques' },
]

const NODE_LABELS: Record<EditorComponentType, string> = {
  input: 'Entrada',
  constant: 'Constante',
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  xor: 'XOR',
  output: 'Saída',
  clock: 'Clock',
  dff: 'DFF',
  tff: 'TFF',
  delay: 'Delay',
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
  const [selectedVectorRow, setSelectedVectorRow] = useState<number | null>(null)
  const [valueStyle, setValueStyle] = useState<ValueStyle>('vf')
  const [hydrated, setHydrated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<CircuitHistory | null>(null)
  const [historyRevision, setHistoryRevision] = useState(0)
  const storage = useCircuitProjects()
  const { user } = useAuth()
  const cloud = useCloudCircuitProjects()
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null)
  const [rooms, setRooms] = useState<CircuitRoom[]>([])
  const [activeRoomId, setActiveRoomId] = useState('main')
  const [newRoomId, setNewRoomId] = useState('')
  const [nextSignalWidth, setNextSignalWidth] = useState(1)
  const [nextClockPeriod, setNextClockPeriod] = useState(1)
  const [nextDelayTicks, setNextDelayTicks] = useState(1)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<CircuitAiResult | null>(null)
  const [sequentialSnapshot, setSequentialSnapshot] = useState<DocumentRuntimeSnapshot | null>(null)
  const [remoteClockPeriods, setRemoteClockPeriods] = useState<Record<string, number> | null>(null)
  const [remoteRuntimeState, setRemoteRuntimeState] = useState<{ state: DocumentRuntimeState; sentAt: string; clientId: string; baseVersion: number } | null>(null)
  const [runtimeMetrics, setRuntimeMetrics] = useState<RuntimeMetrics>(() => ({ ...EMPTY_RUNTIME_METRICS }))
  const [collaborators, setCollaborators] = useState<CircuitCollaborator[]>([])
  const [collaboratorUserId, setCollaboratorUserId] = useState('')
  const [collaboratorRole, setCollaboratorRole] = useState<CollaboratorRole>('editor')

  const document = useMemo(() => ({ ...toDocument(nodes, edges), name: projectName.trim() || 'Circuito visual' }), [nodes, edges, projectName])
  const recordRuntimeEvent = useCallback((event: RuntimeMetricEvent) => {
    setRuntimeMetrics((current) => recordRuntimeMetric(current, event))
  }, [])
  if (!historyRef.current) historyRef.current = new CircuitHistory(document)
  const applyRemoteRuntimeConfig = useCallback((message: { clockPeriods: Record<string, number>; baseVersion: number }) => {
    const currentVersion = cloud.versions[0]?.versionNumber ?? 0
    if (message.baseVersion !== currentVersion) {
      setNotice(`Configuração temporal remota rejeitada: versão-base ${message.baseVersion} diverge da atual ${currentVersion}.`)
      return
    }
    setRemoteClockPeriods({ ...message.clockPeriods })
    setNotice('Configuração temporal remota recebida; runtime reiniciado sem alterar o documento.')
  }, [cloud.versions])

  const applyRemoteRuntimeState = useCallback((message: { state: DocumentRuntimeState; baseVersion: number; sentAt: string; clientId: string }) => {
    const currentVersion = cloud.versions[0]?.versionNumber ?? 0
    if (message.baseVersion !== currentVersion) {
      recordRuntimeEvent('version-conflict')
      setNotice(`Estado temporal remoto rejeitado: versão-base ${message.baseVersion} diverge da atual ${currentVersion}.`)
      return
    }
    const freshness = runtimeFreshness(message.sentAt)
    if (!freshness) {
      recordRuntimeEvent('invalid-or-stale')
      setNotice('Estado temporal remoto expirado e descartado.')
      return
    }
    recordRuntimeEvent('received')
    setRemoteRuntimeState({ state: message.state, sentAt: message.sentAt, clientId: message.clientId, baseVersion: message.baseVersion })
    setNotice('Estado temporal remoto recebido; confirme no painel para aplicá-lo localmente.')
  }, [cloud.versions, recordRuntimeEvent])

  const applyRemoteDocument = useCallback((message: CircuitBroadcast) => {
    if (validateCircuit(message.document).length > 0) return
    historyRef.current?.replace(message.document)
    setHistoryRevision((current) => current + 1)
    const flow = fromDocument(message.document)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setProjectName(message.document.name)
    setSelectedRow(null)
    setNotice(`Alteração remota v${message.baseVersion} aplicada de outro colaborador.`)
  }, [setEdges, setNodes])
  const collaborationBaseVersion = cloud.versions[0]?.versionNumber ?? 0
  const collaboration = useCircuitCollaboration({
    projectId: cloudProjectId,
    roomId: activeRoomId,
    baseVersion: collaborationBaseVersion,
    enabled: Boolean(user && cloudProjectId),
    onRemoteDocument: applyRemoteDocument,
    onRemoteRuntimeConfig: applyRemoteRuntimeConfig,
    onRemoteRuntimeState: applyRemoteRuntimeState,
  })
  useEffect(() => {
    if (historyRef.current?.commit(document)) setHistoryRevision((current) => current + 1)
  }, [document])

  const hasBuses = useMemo(() => document.nodes.some((node) => (node.options?.width ?? 1) > 1), [document])
  const hasSequential = useMemo(
    () => document.nodes.some((node) => node.type === 'clock' || node.type === 'dff' || node.type === 'tff' || node.type === 'delay'),
    [document],
  )
  const issues = useMemo(() => validateCircuit(document, { allowBuses: true }), [document])
  const scalarIssues = useMemo(() => validateCircuit(document), [document])
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
    if (!user || !cloudProjectId) {
      setRooms([])
      setActiveRoomId('main')
      return
    }
    let active = true
    void listCircuitRooms(cloudProjectId).then((items) => {
      if (active) setRooms(items.filter((item) => item.kind === 'document'))
    }).catch(() => {
      if (active) setRooms([])
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
      historyRef.current?.replace(latest.document)
      setHistoryRevision((current) => current + 1)
      loadProject(latest, setNodes, setEdges, setProjectName, setActiveProjectId)
      setNotice(`Circuito local "${latest.name}" restaurado.`)
    }
    setHydrated(true)
  }, [hydrated, setEdges, setNodes, storage.projects, storage.ready])

  const truthTable = useMemo(() => {
    if (hasSequential || scalarIssues.length > 0) return null
    try {
      return buildCircuitTruthTable(document, { outputId: selectedOutputId })
    } catch {
      return null
    }
  }, [document, hasSequential, scalarIssues, selectedOutputId])

  const vectorTruthTable = useMemo(() => {
    if (hasSequential || !hasBuses || issues.length > 0) return null
    try {
      return buildCircuitVectorTruthTable(document)
    } catch {
      return null
    }
  }, [document, hasBuses, hasSequential, issues])

  const selectedEvaluation = useMemo<CircuitEvaluation | CircuitVectorEvaluation | null>(() => {
    if (hasSequential) return null
    if (hasBuses) {
      try {
        return evaluateCircuitVectors(document, vectorAssignmentFromRow(document, vectorTruthTable, selectedVectorRow))
      } catch {
        return null
      }
    }
    if (!truthTable || selectedRow === null) return null
    try {
      return evaluateCircuit(document, assignmentAt(truthTable, selectedRow))
    } catch {
      return null
    }
  }, [document, hasBuses, hasSequential, selectedRow, selectedVectorRow, truthTable, vectorTruthTable])

  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          value: selectedEvaluation
            ? evaluationIsLit(selectedEvaluation, node.id)
            : sequentialSnapshot && hasSequential
              ? runtimeIsLit(sequentialSnapshot, node.id)
              : node.data.componentType === 'constant'
                ? node.data.value
                : node.data.initial,
          busValue: selectedEvaluation && hasBuses ? evaluationBinary(selectedEvaluation, node.id) : undefined,
        },
      })),
    [hasBuses, hasSequential, nodes, selectedEvaluation, sequentialSnapshot],
  )

  const { broadcast: broadcastRemote, broadcastRuntimeConfig, broadcastRuntimeState, status: collaborationStatus } = collaboration
  const readOnlyCollaboration = Boolean(user && collaborators.some((collaborator) => collaborator.userId === user.id && collaborator.role === 'viewer'))
  const canUndo = historyRevision >= 0 && (historyRef.current?.canUndo() ?? false)
  const canRedo = historyRevision >= 0 && (historyRef.current?.canRedo() ?? false)
  const publishRuntimeState = useCallback((state: DocumentRuntimeState) => {
    if (!user || !cloudProjectId || readOnlyCollaboration || collaborationStatus !== 'connected') return
    recordRuntimeEvent('published')
    void broadcastRuntimeState(state, collaborationBaseVersion).catch(() => {
      recordRuntimeEvent('publish-failure')
      setNotice('Não foi possível transmitir o estado temporal para a room atual.')
    })
  }, [broadcastRuntimeState, collaborationBaseVersion, collaborationStatus, cloudProjectId, readOnlyCollaboration, recordRuntimeEvent, user])

  const publishClockPeriods = useCallback((clockPeriods: Readonly<Record<string, number>>) => {
    if (!user || !cloudProjectId || readOnlyCollaboration || collaborationStatus !== 'connected') return
    recordRuntimeEvent('published')
    void broadcastRuntimeConfig(clockPeriods, collaborationBaseVersion).catch(() => {
      recordRuntimeEvent('publish-failure')
      setNotice('Não foi possível transmitir a configuração temporal para a room atual.')
    })
  }, [broadcastRuntimeConfig, collaborationBaseVersion, collaborationStatus, cloudProjectId, readOnlyCollaboration, recordRuntimeEvent, user])

  const restoreHistoryDocument = useCallback((nextDocument: CircuitDocument) => {
    const flow = fromDocument(nextDocument)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setProjectName(nextDocument.name)
    setSelectedRow(null)
  }, [setEdges, setNodes])

  const undo = useCallback(() => {
    if (readOnlyCollaboration) {
      setNotice('Visualizadores não podem desfazer alterações.')
      return
    }
    const previous = historyRef.current?.undo()
    if (!previous) return
    restoreHistoryDocument(previous)
    setHistoryRevision((current) => current + 1)
    setNotice('Última alteração desfeita.')
  }, [readOnlyCollaboration, restoreHistoryDocument])

  const redo = useCallback(() => {
    if (readOnlyCollaboration) {
      setNotice('Visualizadores não podem refazer alterações.')
      return
    }
    const next = historyRef.current?.redo()
    if (!next) return
    restoreHistoryDocument(next)
    setHistoryRevision((current) => current + 1)
    setNotice('Alteração refeita.')
  }, [readOnlyCollaboration, restoreHistoryDocument])

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (key === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleHistoryShortcut)
    return () => window.removeEventListener('keydown', handleHistoryShortcut)
  }, [redo, undo])

  useEffect(() => {
    setSequentialSnapshot(null)
    setRemoteClockPeriods(null)
    setRemoteRuntimeState(null)
    setRuntimeMetrics({ ...EMPTY_RUNTIME_METRICS })
  }, [document])

  useEffect(() => {
    setRuntimeMetrics({ ...EMPTY_RUNTIME_METRICS })
    if (!user || !cloudProjectId) {
      setRemoteClockPeriods(null)
      setRemoteRuntimeState(null)
    }
  }, [activeRoomId, cloudProjectId, user])

  useEffect(() => {
    if (!remoteRuntimeState) return
    const freshness = runtimeFreshness(remoteRuntimeState.sentAt)
    if (!freshness) {
      recordRuntimeEvent('invalid-or-stale')
      setRemoteRuntimeState(null)
      return
    }
    const timeout = window.setTimeout(() => {
      recordRuntimeEvent('expired')
      setRemoteRuntimeState(null)
      setNotice('A oferta de estado temporal expirou; execute novamente para receber um estado atual.')
    }, freshness.expiresInMs)
    return () => window.clearTimeout(timeout)
  }, [recordRuntimeEvent, remoteRuntimeState])

  useEffect(() => {
    if (collaborationStatus !== 'connected') return
    const timer = setTimeout(() => {
      void broadcastRemote(document)
    }, 120)
    return () => clearTimeout(timer)
  }, [broadcastRemote, collaborationBaseVersion, collaborationStatus, document])

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const live = selectedEvaluation
          ? evaluationIsLit(selectedEvaluation, edge.source)
          : sequentialSnapshot && hasSequential
            ? runtimeIsLit(sequentialSnapshot, edge.source, edge.sourceHandle === 'qbar' ? 1 : 0)
            : false
        return {
          ...edge,
          animated: live,
          style: {
            stroke: live ? '#f59e0b' : 'var(--color-slate-400)',
            strokeWidth: live ? 2.4 : 1.6,
          },
        }
      }),
    [edges, hasSequential, selectedEvaluation, sequentialSnapshot],
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
    setNodes((current) => {
      const node = createNode(type, current.length, nextNodeId(type, current), nextSignalWidth)
      if (type === 'clock') node.data.period = nextClockPeriod
      if (type === 'delay') node.data.ticks = nextDelayTicks
      return [...current, node]
    })
  }

  const reset = () => {
    const nextNodes = createDemoNodes()
    const nextEdges = createDemoEdges()
    historyRef.current?.replace({ ...toDocument(nextNodes, nextEdges), name: 'Circuito AND' })
    setHistoryRevision((current) => current + 1)
    setNodes(nextNodes)
    setEdges(nextEdges)
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
    historyRef.current?.replace(project.document)
    setHistoryRevision((current) => current + 1)
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
    if (hasSequential) {
      setNotice('A análise de IA do editor ainda está disponível somente para circuitos combinacionais.')
      return
    }
    if (!user) {
      setNotice('Entre na sua conta para usar a análise de IA.')
      return
    }
    if (scalarIssues.length > 0) {
      setNotice(hasBuses ? 'A análise de IA ainda requer um circuito escalar de 1 bit.' : 'Corrija o circuito antes de pedir uma análise de IA.')
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
    setRooms([])
    setActiveRoomId('main')
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
      setActiveRoomId('main')
      setProjectName(result.project.name)
      setNotice(`Circuito "${result.project.name}" sincronizado na nuvem na versão ${result.version.versionNumber}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível sincronizar o circuito.')
    }
  }

  const openCloud = (project: (typeof cloud.projects)[number]) => {
    historyRef.current?.replace(project.document)
    setHistoryRevision((current) => current + 1)
    const flow = fromDocument(project.document)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setProjectName(project.name)
    setCloudProjectId(project.id)
    setActiveRoomId('main')
    setActiveProjectId(null)
    setSelectedRow(null)
    void cloud.loadVersions(project.id)
    setNotice(`Circuito da nuvem "${project.name}" aberto.`)
  }

  const openCloudVersion = (version: (typeof cloud.versions)[number]) => {
    historyRef.current?.replace(version.document)
    setHistoryRevision((current) => current + 1)
    const flow = fromDocument(version.document)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    setProjectName(version.name)
    setSelectedRow(null)
    setNotice(`Versão ${version.versionNumber} aberta como prévia. Sincronize para criar uma nova versão.`)
  }

  const createRoom = async () => {
    if (!cloudProjectId || !/^[A-Za-z0-9_-]{1,64}$/.test(newRoomId.trim())) {
      setNotice('Use um identificador de sala com até 64 caracteres: letras, números, hífen ou sublinhado.')
      return
    }
    try {
      const room = await createCircuitRoom(cloudProjectId, newRoomId, 'document')
      setRooms((current) => [...current.filter((item) => item.roomId !== room.roomId), room].sort((left, right) => left.createdAt - right.createdAt))
      setActiveRoomId(room.roomId)
      setNewRoomId('')
      setNotice(`Sala "${room.roomId}" criada e ativada.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível criar a sala.')
    }
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

  const issueGuidance = useMemo(() => buildCircuitIssueGuidance(issues), [issues])
  const issueSummary = useMemo(() => summarizeCircuitIssues(issues), [issues])
  const validationMessage =
    issueSummary.valid
      ? hasSequential
        ? 'Circuito sequencial válido: use o workspace de simulação para observar os tiques.'
        : hasBuses
        ? `Circuito vetorial válido: avaliação bitwise ativa para ${document.nodes.filter((node) => (node.options?.width ?? 1) > 1).length} componente(s).`
        : truthTable
          ? `Circuito válido: ${truthTable.variables.length} entrada(s), ${truthTable.totalRows} linha(s).`
          : 'Adicione componentes e conecte as entradas para começar.'
      : issueSummary.message

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="circuit-editor-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase dark:text-brand-300">
            v0.9.0 · prévia
          </p>
          <h2 id="circuit-editor-title" className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            Editor visual combinacional e sequencial
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Monte portas, clocks e elementos de memória no canvas. Circuitos sequenciais são validados, salvos e preparados para simulação por tiques.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400" htmlFor="circuit-signal-width">
            Largura
            <AccessibleTooltip label="Define quantos bits terão os próximos sinais. Use 1 bit para o fluxo escalar e larguras maiores para o fluxo vetorial." />
            <select id="circuit-signal-width" value={nextSignalWidth} onChange={(event) => setNextSignalWidth(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-transparent px-1.5 py-1 text-xs dark:border-slate-700">
              {[1, 2, 4, 8, 16, 32, 64].map((width) => <option key={width} value={width}>{width} bit{width === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400" htmlFor="circuit-clock-period">
            Clock
            <AccessibleTooltip label="Define o período inicial dos próximos componentes Clock, em tiques do simulador." />
            <select id="circuit-clock-period" value={nextClockPeriod} onChange={(event) => setNextClockPeriod(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-transparent px-1.5 py-1 text-xs dark:border-slate-700">
              {[1, 2, 3, 4, 8].map((period) => <option key={period} value={period}>{period} tique{period === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400" htmlFor="circuit-delay-ticks">
            Delay
            <AccessibleTooltip label="Define quantos tiques os próximos componentes Delay aguardam antes de propagar o sinal." />
            <select id="circuit-delay-ticks" value={nextDelayTicks} onChange={(event) => setNextDelayTicks(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-transparent px-1.5 py-1 text-xs dark:border-slate-700">
              {[1, 2, 3, 4, 8].map((ticks) => <option key={ticks} value={ticks}>{ticks} tique{ticks === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          <button type="button" className="key text-xs" onClick={reset}>
            Novo exemplo
          </button>
          <button type="button" className="key text-xs" onClick={undo} disabled={!canUndo || readOnlyCollaboration} aria-label="Desfazer última alteração" title="Ctrl/Cmd+Z">
            Desfazer
          </button>
          <button type="button" className="key text-xs" onClick={redo} disabled={!canRedo || readOnlyCollaboration} aria-label="Refazer alteração" title="Ctrl/Cmd+Shift+Z ou Ctrl/Cmd+Y">
            Refazer
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
          <button type="button" className="key text-xs" onClick={() => downloadIndustrialExport('verilog')} disabled={hasSequential || scalarIssues.length > 0} title={hasSequential ? 'Exportação HDL sequencial será habilitada em uma próxima fatia.' : undefined}>
            Verilog
          </button>
          <button type="button" className="key text-xs" onClick={() => downloadIndustrialExport('vhdl')} disabled={hasSequential || scalarIssues.length > 0} title={hasSequential ? 'Exportação HDL sequencial será habilitada em uma próxima fatia.' : undefined}>
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
          <strong>Como usar:</strong> adicione componentes na paleta, arraste os pontos de saída para as entradas, use Clock/DFF/TFF/Delay para circuitos com estado e salve o desenho no navegador. A tabela verdade permanece exclusiva para circuitos combinacionais.

        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 p-3 dark:border-slate-800" aria-labelledby="circuit-components-title">
          <h3 id="circuit-components-title" className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
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
          <div className="h-[min(420px,70vh)] min-h-[300px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60" role="group" aria-label="Canvas de edição do circuito">
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
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="flex flex-wrap items-center gap-1">
              <strong>{notice || (issueSummary.valid ? 'Validação do circuito' : issueSummary.title)}</strong>
              {!notice && <AccessibleTooltip label="O editor valida conexões, entradas, ciclos e larguras antes de liberar tabela verdade, IA ou exportação." />}
            </div>
            <p className="mt-1">{notice || validationMessage}</p>
            {!notice && issueGuidance.length > 0 && (
              <ul className="mt-2 grid gap-1 text-xs" aria-label="Orientações para corrigir o circuito">
                {issueGuidance.slice(0, 3).map((issue, index) => (
                  <li key={`${issue.code}-${issue.nodeId ?? index}`}>
                    <span className="font-semibold">{issue.title}:</span> {issue.action}
                    {issue.nodeId && <span className="ml-1 opacity-75">Componente: {issue.nodeId}.</span>}
                  </li>
                ))}
                {issueGuidance.length > 3 && <li className="opacity-75">Mais {issueGuidance.length - 3} problema(s) aguardam correção.</li>}
              </ul>
            )}
          </div>
        </div>
      </div>

      {hasSequential && issues.length === 0 && (
        <SequentialCircuitPanel
          document={document}
          requestedClockPeriods={remoteClockPeriods ?? undefined}
          requestedRuntimeState={remoteRuntimeState?.state}
          requestedRuntimeStateSentAt={remoteRuntimeState?.sentAt}
          requestedRuntimeStateClientId={remoteRuntimeState?.clientId}
          requestedRuntimeStateBaseVersion={remoteRuntimeState?.baseVersion}
          currentBaseVersion={collaborationBaseVersion}
          temporalPresenceCount={collaboration.participants.length}
          temporalConnectionStatus={collaborationStatus}
          runtimeMetrics={runtimeMetrics}
          onSnapshot={setSequentialSnapshot}
          onClockPeriodsChange={publishClockPeriods}
          onRuntimeStateChange={publishRuntimeState}
          onRuntimeStateApplied={() => {
            recordRuntimeEvent('applied')
            setRemoteRuntimeState(null)
            setNotice('Estado temporal remoto aplicado com sucesso ao runtime local.')
          }}
          onRuntimeStateStale={() => {
            recordRuntimeEvent('version-conflict')
            setRemoteRuntimeState(null)
            setNotice('Estado temporal remoto obsoleto; receba uma nova oferta antes de aplicar.')
          }}
          onRuntimeStateApplyFailed={() => {
            recordRuntimeEvent('apply-failure')
            setNotice('A oferta foi recebida, mas não pôde ser aplicada ao documento atual.')
          }}
          readOnly={readOnlyCollaboration}
        />
      )}

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
            <strong>{collaboration.status === 'connected' ? 'Colaboração em tempo real ativa' : collaboration.status === 'connecting' ? 'Conectando colaboração…' : 'Colaboração indisponível'} · sala {activeRoomId}</strong>
            {collaboration.participants.length > 0 && <span>{collaboration.participants.length} participante(s) online</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <select value={activeRoomId} onChange={(event) => setActiveRoomId(event.target.value)} className="rounded-lg border border-current/20 bg-transparent px-2 py-1 text-xs" aria-label="Sala de colaboração">
              <option value="main">main (principal)</option>
              {rooms.map((room) => <option key={room.roomId} value={room.roomId}>{room.roomId}</option>)}
            </select>
            <input value={newRoomId} onChange={(event) => setNewRoomId(event.target.value)} className="min-w-44 flex-1 rounded-lg border border-current/20 bg-transparent px-2 py-1 text-xs" placeholder="nova sala: alpha" aria-label="Identificador da nova sala" />
            <button type="button" className="key text-xs" onClick={() => void createRoom()} disabled={!newRoomId.trim()}>Criar sala</button>
          </div>
          {collaboration.error && <p className="mt-1">{collaboration.error}</p>}
          {collaboration.lastRemoteVersion !== null && <p className="mt-1 opacity-80" role="status" aria-live="polite">Última atualização remota aplicada: versão {collaboration.lastRemoteVersion}</p>}
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
            <input value={collaboratorUserId} onChange={(event) => setCollaboratorUserId(event.target.value)} className="min-w-64 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700" placeholder="UUID do usuário" aria-label="UUID do usuário colaborador" />
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

      {user && !hasSequential && issues.length === 0 && (
        <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/70 dark:bg-violet-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-violet-700 uppercase dark:text-violet-300">Assistente de lógica</h3>
              <p className="mt-1 text-xs text-violet-800/80 dark:text-violet-200/80">Analisa o contexto do circuito e propõe uma limpeza conservadora das portas.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="key text-xs" disabled={aiLoading || hasBuses} onClick={() => void runAi('analyze')} title={hasBuses ? 'A análise vetorial de IA será habilitada em uma próxima fatia.' : undefined}>{aiLoading ? 'Analisando…' : 'Analisar com IA'}</button>
              <button type="button" className="key text-xs" disabled={aiLoading || hasBuses} onClick={() => void runAi('optimize')} title={hasBuses ? 'A otimização vetorial de IA será habilitada em uma próxima fatia.' : undefined}>{aiLoading ? 'Otimizando…' : 'Otimizar portas'}</button>
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

      {vectorTruthTable && (
        <section className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">Tabela verdade vetorial</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cada célula representa um barramento completo em ordem MSB → LSB.</p>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">{vectorTruthTable.classification}</span>
          </div>
          <VectorTruthTableView table={vectorTruthTable} selectedRow={selectedVectorRow} onSelectRow={setSelectedVectorRow} />
        </section>
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

  if (data.kind === 'sequential') {
    const isFlipFlop = data.componentType === 'dff' || data.componentType === 'tff'
    const outputClass = `!h-1.5 !w-1.5 !border-0 ${lit ? '!bg-amber-500' : '!bg-slate-400 dark:!bg-slate-500'}`
    return (
      <div className="relative flex h-16 w-24 flex-col items-center justify-center rounded-lg border-2 border-brand-300 bg-white px-2 text-center shadow-sm dark:border-brand-700 dark:bg-slate-900" title={data.label}>
        {data.inputs === 2 && (
          <>
            <Handle type="target" position={Position.Left} id="a" style={{ top: 22 }} className={dot} />
            <Handle type="target" position={Position.Left} id="b" style={{ top: 42 }} className={dot} />
          </>
        )}
        {data.inputs === 1 && <Handle type="target" position={Position.Left} id="a" className={dot} />}
        <span className="font-mono text-sm font-black text-brand-700 dark:text-brand-300">{data.label}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {data.componentType === 'clock' ? `período ${data.period ?? 1}` : data.componentType === 'delay' ? `${data.ticks ?? 1} tique(s)` : isFlipFlop ? 'Q · Q̄' : 'estado'}
        </span>
        <Handle type="source" position={Position.Right} id="q" style={isFlipFlop ? { top: 22 } : undefined} className={outputClass} />
        {isFlipFlop && <Handle type="source" position={Position.Right} id="qbar" style={{ top: 42 }} className={outputClass} />}
      </div>
    )
  }

  if (data.kind === 'input' || data.kind === 'constant') {
    return (
      <div className="flex items-center" style={{ height: 32 }} title={data.width > 1 ? `${data.label} · ${data.width} bits · ${data.busValue ?? 'sem avaliação'}` : data.label}>
        <span className={`grid h-8 min-w-8 place-items-center rounded-full border-2 px-2 font-mono text-sm font-bold transition-colors ${lit ? 'border-amber-500 bg-amber-400/25 text-amber-700 dark:text-amber-200' : 'border-slate-400 bg-white text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'}`}>
          {data.width > 1 ? `${data.label} [${data.busValue ?? '—'}]` : data.label}
        </span>
        <span className={`h-0.5 w-4 ${lit ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
        <Handle type="source" position={Position.Right} className={dot} />
      </div>
    )
  }

  if (data.kind === 'output') {
    return (
      <div className="flex items-center gap-2" title={data.width > 1 ? `${data.label} · ${data.width} bits · ${data.busValue ?? 'sem avaliação'}` : data.label} style={{ height: 40 }}>
        <Handle type="target" position={Position.Left} id="a" className={dot} />
        <span className={`h-0.5 w-4 ${lit ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
        <span className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${lit ? 'border-amber-500 bg-amber-400 shadow-[0_0_12px_2px_rgb(245_158_11/0.6)]' : 'border-slate-400 dark:border-slate-500'}`} />
        <span className="expr font-mono text-xs font-semibold whitespace-nowrap">{data.width > 1 ? `${data.label} [${data.width}b]` : data.label}</span>
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: 72, height: 56 }} title={data.width > 1 ? `${data.label} · ${data.width} bits · ${data.busValue ?? 'sem avaliação'}` : data.label}>
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

function buildNodeOptions(data: EditorNodeData): CircuitNode['options'] {
  const options: NonNullable<CircuitNode['options']> = {}
  if (data.componentType === 'constant') options.value = data.value ?? false
  if (data.componentType === 'clock') options.period = Math.max(1, Math.floor(data.period ?? 1))
  if (data.componentType === 'delay') options.ticks = Math.max(1, Math.floor(data.ticks ?? 1))
  if (data.componentType === 'input' || data.componentType === 'clock' || data.componentType === 'dff' || data.componentType === 'tff') {
    options.initial = data.initial ?? false
  }
  if (data.width !== 1) options.width = data.width
  return Object.keys(options).length > 0 ? options : undefined
}

function toDocument(nodes: EditorFlowNode[], edges: Edge[]): CircuitDocument {
  const editorNodes: CircuitNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.data.componentType,
    position: node.position,
    label: node.data.label,
    options: buildNodeOptions(node.data),
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
          source: { node: edge.source, ...(edge.sourceHandle === 'qbar' ? { port: 1 } : {}) },
          target: { node: edge.target, port: edge.targetHandle === 'b' ? 1 : 0 },
        },
      ]
    }),
  }
}

function createNode(type: EditorComponentType, index: number, id = `${type}-${index + 1}`, width = 1): EditorFlowNode {
  const kind = type === 'input' || type === 'constant'
    ? type
    : type === 'output'
      ? 'output'
      : type === 'clock' || type === 'dff' || type === 'tff' || type === 'delay'
        ? 'sequential'
        : 'gate'
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
      width,
      op: type === 'not' ? 'not' : type === 'and' || type === 'or' || type === 'xor' ? type : undefined,
      value: defaultValue,
      initial: false,
      period: type === 'clock' ? 1 : undefined,
      ticks: type === 'delay' ? 1 : undefined,
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
          width: source.options?.width ?? 1,
          value: source.options?.value ?? source.options?.initial ?? node.data.value,
          initial: source.options?.initial ?? false,
          period: source.options?.period ?? 1,
          ticks: source.options?.ticks ?? 1,
        },
      }
    }),
    edges: document.connections.map((connection) => {
      const sourceNode = document.nodes.find((node) => node.id === connection.source.node)
      const hasNamedOutputs = sourceNode?.type === 'dff' || sourceNode?.type === 'tff'
      return {
        id: `${connection.source.node}->${connection.target.node}:${connection.source.port === 1 ? 'qbar' : 'q'}:${connection.target.port === 1 ? 'b' : 'a'}`,
        source: connection.source.node,
        ...(hasNamedOutputs ? { sourceHandle: connection.source.port === 1 ? 'qbar' : 'q' } : {}),
        target: connection.target.node,
        targetHandle: connection.target.port === 1 ? 'b' : 'a',
        type: 'smoothstep',
      }
    }),
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

function vectorAssignmentFromRow(document: CircuitDocument, table: CircuitVectorTruthTable | null, rowIndex: number | null): Record<string, BitVector> {
  if (!table || rowIndex === null || !table.rows[rowIndex]) return {}
  const inputs = document.nodes.filter((node) => node.type === 'input')
  return Object.fromEntries(inputs.map((node, index) => [node.id, parseBusLiteral(table.rows[rowIndex][index], node.options?.width ?? 1)]))
}

function runtimeIsLit(snapshot: DocumentRuntimeSnapshot, nodeId: string, port = 0): boolean {
  return snapshot.values[nodeId]?.[port] === true
}

function evaluationIsLit(evaluation: CircuitEvaluation | CircuitVectorEvaluation, nodeId: string): boolean {
  const value = evaluation.values[nodeId]
  if (!value) return false
  return 'bits' in value ? value.bits.some(Boolean) : value[0] === true
}

function evaluationBinary(evaluation: CircuitEvaluation | CircuitVectorEvaluation, nodeId: string): string {
  const value = evaluation.values[nodeId]
  if (!value) return ''
  return 'bits' in value ? toBinary(value) : value[0] ? '1' : '0'
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
}

function safeFileName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'circuito'
}
