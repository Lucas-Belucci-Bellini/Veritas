import { describe, expect, it } from "vitest";
import { buildTruthTable, parse } from "../../src/engine";
import {
  createCircuitDocument,
  type CircuitConnection,
  type CircuitDocument,
  type CircuitNode,
  type EditorComponentType,
} from "../../src/circuit";
import { createDocumentRuntime } from "../../src/simulation/documentRuntime";

type CrossRuntimeCase = {
  name: string;
  expression: string;
  document: CircuitDocument;
  outputId: string;
};

function node(
  id: string,
  type: EditorComponentType,
  label?: string,
  x = 0,
  y = 0,
): CircuitNode {
  return {
    id,
    type,
    position: { x, y },
    ...(label ? { label } : {}),
  };
}

function wire(source: string, target: string, port = 0): CircuitConnection {
  return { source: { node: source }, target: { node: target, port } };
}

function documentFrom(
  name: string,
  nodes: CircuitNode[],
  connections: CircuitConnection[],
): CircuitDocument {
  return { ...createCircuitDocument(name), nodes, connections };
}

function binaryGateCase(
  type: Extract<
    EditorComponentType,
    "and" | "nand" | "or" | "nor" | "xor" | "xnor"
  >,
  expression: string,
): CrossRuntimeCase {
  return {
    name: type.toUpperCase(),
    expression,
    outputId: "out",
    document: documentFrom(
      type.toUpperCase(),
      [
        node("a", "input", "A"),
        node("b", "input", "B", 0, 80),
        node("gate", type, undefined, 180, 40),
        node("out", "output", expression, 360, 40),
      ],
      [wire("a", "gate", 0), wire("b", "gate", 1), wire("gate", "out")],
    ),
  };
}

const fundamentalCases: CrossRuntimeCase[] = [
  binaryGateCase("and", "A AND B"),
  binaryGateCase("nand", "A NAND B"),
  binaryGateCase("or", "A OR B"),
  binaryGateCase("nor", "A NOR B"),
  binaryGateCase("xor", "A XOR B"),
  binaryGateCase("xnor", "A XNOR B"),
  {
    name: "NOT",
    expression: "NOT A",
    outputId: "out",
    document: documentFrom(
      "NOT",
      [
        node("a", "input", "A"),
        node("gate", "not", undefined, 180, 0),
        node("out", "output", "NOT A", 360, 0),
      ],
      [wire("a", "gate"), wire("gate", "out")],
    ),
  },
];

const knownCircuitCases: CrossRuntimeCase[] = [
  {
    name: "Half Adder · soma",
    expression: "A XOR B",
    outputId: "sum",
    document: documentFrom(
      "Half Adder",
      [
        node("a", "input", "A"),
        node("b", "input", "B", 0, 100),
        node("sumGate", "xor", "SUM", 180, 20),
        node("carryGate", "and", "CARRY", 180, 120),
        node("sum", "output", "SUM", 360, 20),
        node("carry", "output", "CARRY", 360, 120),
      ],
      [
        wire("a", "sumGate", 0),
        wire("b", "sumGate", 1),
        wire("a", "carryGate", 0),
        wire("b", "carryGate", 1),
        wire("sumGate", "sum"),
        wire("carryGate", "carry"),
      ],
    ),
  },
  {
    name: "Half Adder · carry",
    expression: "A AND B",
    outputId: "carry",
    document: documentFrom(
      "Half Adder",
      [
        node("a", "input", "A"),
        node("b", "input", "B", 0, 100),
        node("sumGate", "xor", "SUM", 180, 20),
        node("carryGate", "and", "CARRY", 180, 120),
        node("sum", "output", "SUM", 360, 20),
        node("carry", "output", "CARRY", 360, 120),
      ],
      [
        wire("a", "sumGate", 0),
        wire("b", "sumGate", 1),
        wire("a", "carryGate", 0),
        wire("b", "carryGate", 1),
        wire("sumGate", "sum"),
        wire("carryGate", "carry"),
      ],
    ),
  },
  {
    name: "Full Adder · soma",
    expression: "(A XOR B) XOR C",
    outputId: "sum",
    document: fullAdderDocument(),
  },
  {
    name: "Full Adder · carry",
    expression: "(A AND B) OR ((A XOR B) AND C)",
    outputId: "carry",
    document: fullAdderDocument(),
  },
  {
    name: "Multiplexer 2:1",
    expression: "(S AND A) OR (NOT S AND B)",
    outputId: "out",
    document: multiplexerDocument(),
  },
];

function fullAdderDocument(): CircuitDocument {
  return documentFrom(
    "Full Adder",
    [
      node("a", "input", "A"),
      node("b", "input", "B", 0, 80),
      node("c", "input", "C", 0, 160),
      node("xorAB", "xor", "A XOR B", 180, 20),
      node("sumGate", "xor", "SUM", 360, 20),
      node("andAB", "and", "A AND B", 180, 120),
      node("andCarry", "and", "CARRY TERM", 360, 140),
      node("carryGate", "or", "CARRY", 540, 120),
      node("sum", "output", "SUM", 540, 20),
      node("carry", "output", "CARRY", 720, 120),
    ],
    [
      wire("a", "xorAB", 0),
      wire("b", "xorAB", 1),
      wire("xorAB", "sumGate", 0),
      wire("c", "sumGate", 1),
      wire("a", "andAB", 0),
      wire("b", "andAB", 1),
      wire("xorAB", "andCarry", 0),
      wire("c", "andCarry", 1),
      wire("andAB", "carryGate", 0),
      wire("andCarry", "carryGate", 1),
      wire("sumGate", "sum"),
      wire("carryGate", "carry"),
    ],
  );
}

function multiplexerDocument(): CircuitDocument {
  return documentFrom(
    "Multiplexer 2:1",
    [
      node("a", "input", "A"),
      node("b", "input", "B", 0, 100),
      node("s", "input", "S", 0, 200),
      node("notSel", "not", "NOT S", 180, 180),
      node("selectedA", "and", "S AND A", 360, 20),
      node("selectedB", "and", "NOT S AND B", 360, 140),
      node("outGate", "or", "MUX", 540, 80),
      node("out", "output", "OUT", 720, 80),
    ],
    [
      wire("s", "notSel"),
      wire("s", "selectedA", 0),
      wire("a", "selectedA", 1),
      wire("notSel", "selectedB", 0),
      wire("b", "selectedB", 1),
      wire("selectedA", "outGate", 0),
      wire("selectedB", "outGate", 1),
      wire("outGate", "out"),
    ],
  );
}

function runCrossRuntimeCase(testCase: CrossRuntimeCase): void {
  const expressionTable = buildTruthTable(parse(testCase.expression), {
    includeSteps: false,
  });
  const runtime = createDocumentRuntime(testCase.document);
  const divergences: Array<{
    row: number;
    assignment: Record<string, boolean>;
    expected: boolean;
    actual: boolean;
  }> = [];

  for (const [rowIndex, row] of expressionTable.rows.entries()) {
    const assignment = Object.fromEntries(
      expressionTable.variables.map((variable, index) => [
        variable,
        row[index] ?? false,
      ]),
    );
    runtime.reset();
    for (const [inputId, value] of Object.entries(assignment))
      runtime.setInput(inputId.toLowerCase(), value);
    const settled = runtime.settle();
    const expected = row.at(-1) ?? false;
    const actual = runtime.read(testCase.outputId);
    if (!settled || actual !== expected)
      divergences.push({ row: rowIndex, assignment, expected, actual });
  }

  expect({
    case: testCase.name,
    expression: testCase.expression,
    totalRows: expressionTable.totalRows,
    divergences,
  }).toEqual({
    case: testCase.name,
    expression: testCase.expression,
    totalRows: expressionTable.totalRows,
    divergences: [],
  });
}

describe("regressão permanente Expression → TruthTable vs Circuit → Simulator", () => {
  it.each(fundamentalCases)(
    "$name concorda em todas as linhas da tabela",
    (testCase) => {
      runCrossRuntimeCase(testCase);
    },
  );

  it.each(knownCircuitCases)(
    "$name concorda em todas as linhas da tabela",
    (testCase) => {
      runCrossRuntimeCase(testCase);
    },
  );
});
