import {
  ALGORITHM_DOCUMENT_FORMAT,
  ALGORITHM_DOCUMENT_VERSION,
  isRuntimeValueOfType,
  type AlgorithmDocument,
  type AlgorithmNode,
  type AlgorithmValidationIssue,
} from './model'

function targetsForNode(node: AlgorithmNode): string[] {
  switch (node.type) {
    case 'start':
    case 'declare':
    case 'assign':
    case 'input':
    case 'output':
      return [node.next]
    case 'if':
      return [node.thenNext, node.elseNext]
    case 'end':
      return []
  }
}

export function validateAlgorithmDocument(
  document: AlgorithmDocument,
): AlgorithmValidationIssue[] {
  const issues: AlgorithmValidationIssue[] = []
  const nodes = new Map<string, AlgorithmNode>()

  if (document.format !== ALGORITHM_DOCUMENT_FORMAT) {
    issues.push({
      code: 'invalid-format',
      message: `Formato de algoritmo inválido: esperado "${ALGORITHM_DOCUMENT_FORMAT}".`,
      severity: 'error',
    })
  }
  if (document.version > ALGORITHM_DOCUMENT_VERSION) {
    issues.push({
      code: 'unsupported-version',
      message: 'O algoritmo foi salvo por uma versão mais nova do Veritas.',
      severity: 'error',
    })
  }

  for (const node of document.nodes) {
    if (!node.id.trim() || nodes.has(node.id)) {
      issues.push({
        code: 'duplicate-node',
        message: `O identificador do nó "${node.id}" está vazio ou duplicado.`,
        nodeId: node.id,
        severity: 'error',
      })
      continue
    }
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      issues.push({
        code: 'invalid-position',
        message: `A posição do nó "${node.id}" não é finita.`,
        nodeId: node.id,
        severity: 'error',
      })
    }
    nodes.set(node.id, node)
  }

  if (!nodes.has(document.entryNodeId)) {
    issues.push({
      code: 'missing-entry',
      message: `O nó de entrada "${document.entryNodeId}" não existe.`,
      severity: 'error',
    })
  }

  const variableDeclarations = new Map<string, string>()
  for (const node of nodes.values()) {
    if (node.type === 'declare') {
      if (variableDeclarations.has(node.variable)) {
        issues.push({
          code: 'duplicate-variable',
          message: `A variável "${node.variable}" foi declarada mais de uma vez.`,
          nodeId: node.id,
          severity: 'error',
        })
      }
      variableDeclarations.set(node.variable, node.id)
      if (!isRuntimeValueOfType(node.initialValue ?? null, node.valueType)) {
        issues.push({
          code: 'invalid-initial-value',
          message: `O valor inicial da variável "${node.variable}" não é compatível com ${node.valueType}.`,
          nodeId: node.id,
          severity: 'error',
        })
      }
    }
  }

  for (const node of nodes.values()) {
    const targets = targetsForNode(node)
    for (const target of targets) {
      if (!nodes.has(target)) {
        issues.push({
          code: node.type === 'if' ? 'missing-branch' : 'missing-target',
          message: `O nó "${node.id}" aponta para "${target}", que não existe.`,
          nodeId: node.id,
          severity: 'error',
        })
      }
    }
  }

  const reachable = new Set<string>()
  const visit = (id: string): void => {
    if (reachable.has(id)) return
    const node = nodes.get(id)
    if (!node) return
    reachable.add(id)
    for (const target of targetsForNode(node)) visit(target)
  }
  visit(document.entryNodeId)

  for (const node of nodes.values()) {
    if (!reachable.has(node.id)) {
      issues.push({
        code: 'unreachable-node',
        message: `O nó "${node.id}" não é alcançável a partir da entrada.`,
        nodeId: node.id,
        severity: 'warning',
      })
    }
  }

  return issues
}

export function hasValidationErrors(issues: readonly AlgorithmValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}
