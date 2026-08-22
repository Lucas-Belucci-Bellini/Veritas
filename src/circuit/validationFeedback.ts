import type { CircuitIssue } from './editorModel'

export interface CircuitIssueGuidance {
  code: CircuitIssue['code']
  nodeId?: string
  message: string
  title: string
  action: string
}

export interface CircuitValidationSummary {
  valid: boolean
  title: string
  message: string
}

const GUIDANCE: Record<CircuitIssue['code'], Pick<CircuitIssueGuidance, 'title' | 'action'>> = {
  'duplicate-node': {
    title: 'Identificador duplicado',
    action: 'Renomeie o componente para um identificador único antes de salvar ou exportar.',
  },
  'invalid-node': {
    title: 'Componente não suportado',
    action: 'Remova o componente inválido e adicione uma opção disponível na paleta.',
  },
  'missing-node': {
    title: 'Conexão quebrada',
    action: 'Remova o fio quebrado e conecte novamente dois componentes existentes.',
  },
  'invalid-source-port': {
    title: 'Saída inexistente',
    action: 'Reconecte o fio a uma saída disponível no componente de origem.',
  },
  'invalid-target-port': {
    title: 'Entrada inexistente',
    action: 'Reconecte o fio a uma entrada disponível no componente de destino.',
  },
  'duplicate-target-port': {
    title: 'Entrada conectada duas vezes',
    action: 'Remova uma das conexões desta entrada; cada entrada aceita somente um fio.',
  },
  'self-connection': {
    title: 'Auto conexão inválida',
    action: 'Remova o laço do componente; ciclos combinacionais não são permitidos.',
  },
  'missing-input': {
    title: 'Entrada desconectada',
    action: 'Conecte todas as entradas indicadas antes de avaliar o circuito.',
  },
  cycle: {
    title: 'Ciclo combinacional',
    action: 'Interrompa o ciclo conectando o fluxo a uma saída ou use um componente sequencial apropriado.',
  },
  'invalid-width': {
    title: 'Largura inválida',
    action: 'Escolha uma largura inteira entre 1 e 64 bits para o componente.',
  },
  'unsupported-width': {
    title: 'Largura ainda não suportada neste fluxo',
    action: 'Use 1 bit neste componente ou permaneça no fluxo vetorial compatível.',
  },
  'width-mismatch': {
    title: 'Larguras incompatíveis',
    action: 'Ajuste os componentes conectados para usar a mesma largura de sinal.',
  },
  'invalid-document-name': {
    title: 'Nome de circuito inválido',
    action: 'Use um nome entre 1 e 200 caracteres para o circuito.',
  },
  'document-too-many-nodes': {
    title: 'Limite de componentes atingido',
    action: 'Reduza a quantidade de componentes ou divida o projeto em subcircuitos.',
  },
  'document-too-many-connections': {
    title: 'Limite de conexões atingido',
    action: 'Reduza conexões redundantes ou divida o projeto em subcircuitos.',
  },
  'node-label-too-long': {
    title: 'Rótulo muito longo',
    action: 'Reduza o rótulo do componente para no máximo 120 caracteres.',
  },
  'document-too-large': {
    title: 'Documento muito grande',
    action: 'Reduza o circuito ou divida-o em projetos menores antes de salvar.',
  },
  'wireless-empty-channel': {
    title: 'Canal wireless ausente',
    action: 'Informe um nome de canal no transmissor ou receptor wireless.',
  },
  'wireless-duplicate-transmitter': {
    title: 'Transmissores wireless duplicados',
    action: 'Mantenha somente um transmissor por canal wireless.',
  },
  'wireless-missing-transmitter': {
    title: 'Receptor wireless sem transmissor',
    action: 'Adicione um transmissor no mesmo canal ou altere o nome do canal.',
  },
  'wireless-channel-too-long': {
    title: 'Canal wireless muito longo',
    action: 'Reduza o nome do canal para no máximo 64 caracteres.',
  },
  'custom-chip-missing-definition': {
    title: 'Definição de chip ausente',
    action: 'Recarregue a biblioteca local ou remova a instância que aponta para um chip indisponível.',
  },
}

export function buildCircuitIssueGuidance(issues: readonly CircuitIssue[]): CircuitIssueGuidance[] {
  return issues.map((issue) => ({
    ...issue,
    ...GUIDANCE[issue.code],
  }))
}

export function summarizeCircuitIssues(issues: readonly CircuitIssue[]): CircuitValidationSummary {
  if (issues.length === 0) {
    return {
      valid: true,
      title: 'Circuito validado',
      message: 'Nenhum problema de estrutura foi encontrado.',
    }
  }

  const first = buildCircuitIssueGuidance(issues)[0]
  return {
    valid: false,
    title: `${issues.length} problema${issues.length === 1 ? '' : 's'} para corrigir`,
    message: `${first.title}: ${first.action}`,
  }
}
