import { createAlgorithmDocument, type AlgorithmDocument } from './model'

export function createImplicationExample(): AlgorithmDocument {
  const document = createAlgorithmDocument('Implicação material — P → Q')
  return {
    ...document,
    nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 80 }, next: 'declare-p' },
      {
        id: 'declare-p',
        type: 'declare',
        position: { x: 180, y: 80 },
        variable: 'P',
        valueType: 'boolean',
        initialValue: false,
        next: 'declare-q',
      },
      {
        id: 'declare-q',
        type: 'declare',
        position: { x: 360, y: 80 },
        variable: 'Q',
        valueType: 'boolean',
        initialValue: false,
        next: 'input-p',
      },
      {
        id: 'input-p',
        type: 'input',
        position: { x: 540, y: 80 },
        variable: 'P',
        prompt: 'O antecedente P é verdadeiro?',
        next: 'input-q',
      },
      {
        id: 'input-q',
        type: 'input',
        position: { x: 720, y: 80 },
        variable: 'Q',
        prompt: 'O consequente Q é verdadeiro?',
        next: 'if-implication',
      },
      {
        id: 'if-implication',
        type: 'if',
        position: { x: 900, y: 80 },
        condition: 'NOT P OR Q',
        thenNext: 'satisfied',
        elseNext: 'counterexample',
      },
      {
        id: 'satisfied',
        type: 'output',
        position: { x: 1080, y: 0 },
        expression: "'implicação satisfeita'",
        next: 'end',
      },
      {
        id: 'counterexample',
        type: 'output',
        position: { x: 1080, y: 160 },
        expression: "'contraexemplo: P verdadeiro e Q falso'",
        next: 'end',
      },
      { id: 'end', type: 'end', position: { x: 1260, y: 80 } },
    ],
  }
}
