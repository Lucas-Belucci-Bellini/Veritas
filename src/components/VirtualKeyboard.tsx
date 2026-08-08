import { Delete } from 'lucide-react'
import { OPERATOR_GLYPHS, type Notation } from '../engine'

type OperatorKey = keyof typeof OPERATOR_GLYPHS

const VARIABLES = ['P', 'Q', 'R', 'A', 'B', 'C', 'D']
const BASIC: OperatorKey[] = ['and', 'or', 'not']
const ADVANCED: OperatorKey[] = ['xor', 'nand', 'nor', 'xnor', 'implies', 'iff']

const OPERATOR_NAMES: Record<OperatorKey, string> = {
  and: 'E',
  or: 'OU',
  not: 'NÃO',
  nand: 'NÃO-E',
  nor: 'NÃO-OU',
  xor: 'OU exclusivo',
  xnor: 'Equivalência',
  implies: 'Implica',
  iff: 'Se e somente se',
}

/** Texto que vai para o input ao clicar no botão, já espaçado. */
function operatorInsert(op: OperatorKey, notation: Notation): string {
  const glyph = OPERATOR_GLYPHS[op][notation]
  return op === 'not' ? `${glyph}` : ` ${glyph} `
}

interface VirtualKeyboardProps {
  notation: Notation
  onInsert: (text: string) => void
  onBackspace: () => void
}

/**
 * Teclado de símbolos. Ninguém sabe digitar ⊕ ou ↔ no teclado físico, então
 * eles ficam a um clique de distância — e mudam de cara conforme a notação
 * escolhida pelo usuário.
 */
export function VirtualKeyboard({
  notation,
  onInsert,
  onBackspace,
}: VirtualKeyboardProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Group title="Variáveis">
        {VARIABLES.map((name) => (
          <button
            key={name}
            type="button"
            className="key font-mono"
            onClick={() => onInsert(name)}
          >
            {name}
          </button>
        ))}
      </Group>

      <Group title="Operadores">
        {BASIC.map((op) => (
          <OperatorButton key={op} op={op} notation={notation} onInsert={onInsert} />
        ))}
      </Group>

      <Group title="Avançados">
        {ADVANCED.map((op) => (
          <OperatorButton key={op} op={op} notation={notation} onInsert={onInsert} />
        ))}
      </Group>

      <Group title="Agrupamento e constantes">
        <button type="button" className="key font-mono" onClick={() => onInsert('(')}>
          (
        </button>
        <button type="button" className="key font-mono" onClick={() => onInsert(')')}>
          )
        </button>
        <button
          type="button"
          className="key font-mono"
          title="Verdadeiro"
          onClick={() => onInsert('1')}
        >
          1
        </button>
        <button
          type="button"
          className="key font-mono"
          title="Falso"
          onClick={() => onInsert('0')}
        >
          0
        </button>
        <button
          type="button"
          className="key"
          title="Apagar"
          aria-label="Apagar"
          onClick={onBackspace}
        >
          <Delete size={18} />
        </button>
      </Group>
    </div>
  )
}

function OperatorButton({
  op,
  notation,
  onInsert,
}: {
  op: OperatorKey
  notation: Notation
  onInsert: (text: string) => void
}) {
  return (
    <button
      type="button"
      className="key expr"
      title={OPERATOR_NAMES[op]}
      onClick={() => onInsert(operatorInsert(op, notation))}
    >
      {OPERATOR_GLYPHS[op][notation]}
    </button>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
