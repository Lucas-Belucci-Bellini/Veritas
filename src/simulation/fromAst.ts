import type { AstNode, BinaryOp } from '../engine/ast'
import type { ComponentSpec, ComponentType, Netlist, PortRef } from './components'

export interface AstNetlist {
  netlist: Netlist
  /** Componente de entrada criado para cada variável. */
  inputs: Record<string, string>
  /** Componente que carrega o resultado final. */
  outputId: string
}

/** Portas que existem como componente; as demais são montadas com estas. */
const DIRECT_GATES: Partial<Record<BinaryOp, ComponentType>> = {
  and: 'and',
  nand: 'nand',
  or: 'or',
  nor: 'nor',
  xor: 'xor',
  xnor: 'xnor',
  iff: 'xnor',
}

/**
 * Monta um circuito combinacional equivalente à expressão.
 *
 * É a ponte entre os dois motores: o mesmo texto vira tabela verdade por um
 * lado e circuito simulável por outro, e os testes conferem que os dois
 * concordam em todas as combinações.
 */
export function netlistFromAst(ast: AstNode): AstNetlist {
  const components: ComponentSpec[] = []
  const inputs: Record<string, string> = {}
  let counter = 0

  const nextId = (prefix: string) => `${prefix}${(counter += 1)}`

  const add = (
    type: ComponentType,
    inputRefs: PortRef[],
    options?: ComponentSpec['options'],
  ): string => {
    const id = nextId(type)
    components.push({ id, type, inputs: inputRefs, options })
    return id
  }

  const visit = (node: AstNode): string => {
    switch (node.kind) {
      case 'var': {
        const existing = inputs[node.name]
        if (existing) return existing
        const id = nextId('in_')
        components.push({ id, type: 'input', label: node.name })
        inputs[node.name] = id
        return id
      }

      case 'const':
        return add('constant', [], { value: node.value })

      case 'not':
        return add('not', [{ node: visit(node.operand) }])

      case 'binary': {
        const left = visit(node.left)
        const right = visit(node.right)

        const direct = DIRECT_GATES[node.op]
        if (direct) return add(direct, [{ node: left }, { node: right }])

        // A → B é a mesma coisa que ¬A ∨ B.
        const negated = add('not', [{ node: left }])
        return add('or', [{ node: negated }, { node: right }])
      }
    }
  }

  const rootId = visit(ast)
  const outputId = nextId('out_')
  components.push({ id: outputId, type: 'output', inputs: [{ node: rootId }] })

  return { netlist: { components }, inputs, outputId }
}
