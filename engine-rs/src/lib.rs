//! Deterministic, dependency-free combinational engine for Veritas.
//!
//! The first Rust slice intentionally stays below the application boundary:
//! it evaluates a validated netlist with scalar or up-to-64-bit signals. The
//! TypeScript engine remains the production adapter until cross-language golden
//! tests and a WASM packaging decision are complete.

use std::collections::{HashMap, HashSet};
use std::fmt;

pub const MAX_WIDTH: u8 = 64;

/// Version of the intentionally minimal WASM readiness ABI.
pub const WASM_ABI_VERSION: u32 = 1;
/// Bit 0 advertises only that the ABI marker is available; no evaluator is exported.
pub const WASM_CAPABILITY_ABI_MARKER: u32 = 1;

#[no_mangle]
pub extern "C" fn veritas_wasm_abi_version() -> u32 {
    WASM_ABI_VERSION
}

#[no_mangle]
pub extern "C" fn veritas_wasm_capabilities() -> u32 {
    WASM_CAPABILITY_ABI_MARKER
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Signal {
    pub width: u8,
    pub bits: u64,
}

impl Signal {
    pub fn new(width: u8, bits: u64) -> Result<Self, EvalError> {
        if !(1..=MAX_WIDTH).contains(&width) {
            return Err(EvalError::InvalidWidth(width));
        }
        if bits & !mask(width) != 0 {
            return Err(EvalError::ValueDoesNotFit { width, bits });
        }
        Ok(Self { width, bits })
    }

    pub fn zero(width: u8) -> Result<Self, EvalError> {
        Self::new(width, 0)
    }

    pub fn not(self) -> Self {
        Self {
            width: self.width,
            bits: (!self.bits) & mask(self.width),
        }
    }

    pub fn binary_and(self, other: Self) -> Result<Self, EvalError> {
        self.binary(other, |left, right| left & right)
    }

    pub fn binary_or(self, other: Self) -> Result<Self, EvalError> {
        self.binary(other, |left, right| left | right)
    }

    pub fn binary_xor(self, other: Self) -> Result<Self, EvalError> {
        self.binary(other, |left, right| left ^ right)
    }

    fn binary(self, other: Self, operation: fn(u64, u64) -> u64) -> Result<Self, EvalError> {
        if self.width != other.width {
            return Err(EvalError::WidthMismatch {
                expected: self.width,
                actual: other.width,
            });
        }
        Ok(Self {
            width: self.width,
            bits: operation(self.bits, other.bits) & mask(self.width),
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum NodeKind {
    Input { initial: Signal },
    Constant { value: Signal },
    And,
    Nand,
    Or,
    Nor,
    Xor,
    Xnor,
    Not,
    Output,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Node {
    pub id: String,
    pub kind: NodeKind,
    /// Source node IDs in the same order as the canonical Veritas netlist.
    pub inputs: Vec<String>,
}

impl Node {
    pub fn input(id: impl Into<String>, initial: Signal) -> Self {
        Self {
            id: id.into(),
            kind: NodeKind::Input { initial },
            inputs: Vec::new(),
        }
    }

    pub fn constant(id: impl Into<String>, value: Signal) -> Self {
        Self {
            id: id.into(),
            kind: NodeKind::Constant { value },
            inputs: Vec::new(),
        }
    }

    pub fn gate(id: impl Into<String>, kind: NodeKind, inputs: Vec<String>) -> Self {
        Self {
            id: id.into(),
            kind,
            inputs,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Netlist {
    pub nodes: Vec<Node>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Evaluation {
    pub values: Vec<(String, Signal)>,
    pub outputs: Vec<(String, Signal)>,
    pub order: Vec<String>,
}

impl Evaluation {
    pub fn value(&self, id: &str) -> Option<Signal> {
        self.values
            .iter()
            .find(|(node_id, _)| node_id == id)
            .map(|(_, signal)| *signal)
    }

    pub fn output(&self, id: &str) -> Option<Signal> {
        self.outputs
            .iter()
            .find(|(node_id, _)| node_id == id)
            .map(|(_, signal)| *signal)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EvalError {
    DuplicateNode(String),
    MissingNode {
        node: String,
        dependency: String,
    },
    Cycle,
    InvalidWidth(u8),
    ValueDoesNotFit {
        width: u8,
        bits: u64,
    },
    WidthMismatch {
        expected: u8,
        actual: u8,
    },
    MissingInput(String),
    MissingOperand {
        node: String,
    },
    UnsupportedInputShape {
        node: String,
        expected: usize,
        actual: usize,
    },
}

impl fmt::Display for EvalError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DuplicateNode(id) => write!(formatter, "duplicate node: {id}"),
            Self::MissingNode { node, dependency } => {
                write!(
                    formatter,
                    "node {node} depends on missing node {dependency}"
                )
            }
            Self::Cycle => write!(formatter, "netlist contains a combinational cycle"),
            Self::InvalidWidth(width) => {
                write!(formatter, "width must be between 1 and 64, got {width}")
            }
            Self::ValueDoesNotFit { width, bits } => {
                write!(formatter, "value {bits} does not fit in {width} bits")
            }
            Self::WidthMismatch { expected, actual } => {
                write!(
                    formatter,
                    "signal width mismatch: expected {expected}, got {actual}"
                )
            }
            Self::MissingInput(id) => write!(formatter, "missing input value for {id}"),
            Self::MissingOperand { node } => write!(formatter, "node {node} has no operand"),
            Self::UnsupportedInputShape {
                node,
                expected,
                actual,
            } => {
                write!(
                    formatter,
                    "node {node} expects {expected} operands, got {actual}"
                )
            }
        }
    }
}

impl std::error::Error for EvalError {}

pub fn evaluate(
    netlist: &Netlist,
    overrides: &[(String, Signal)],
) -> Result<Evaluation, EvalError> {
    let order = topological_order(netlist)?;
    let nodes: HashMap<&str, &Node> = netlist
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect();
    let override_values: HashMap<&str, Signal> = overrides
        .iter()
        .map(|(id, value)| (id.as_str(), *value))
        .collect();
    let mut values = HashMap::with_capacity(netlist.nodes.len());

    for id in &order {
        let node = nodes
            .get(id.as_str())
            .expect("topological order only contains known nodes");
        let operands: Result<Vec<Signal>, EvalError> =
            node.inputs
                .iter()
                .map(|dependency| {
                    values.get(dependency.as_str()).copied().ok_or_else(|| {
                        EvalError::MissingOperand {
                            node: node.id.clone(),
                        }
                    })
                })
                .collect();
        let operands = operands?;
        let signal = match &node.kind {
            NodeKind::Input { initial } => override_values
                .get(id.as_str())
                .copied()
                .unwrap_or(*initial),
            NodeKind::Constant { value } => *value,
            NodeKind::And => fold_gate(&operands, false, |left, right| {
                left.binary(right, |a, b| a & b)
            })?,
            NodeKind::Nand => fold_gate(&operands, true, |left, right| {
                left.binary(right, |a, b| a & b)
            })?,
            NodeKind::Or => fold_gate(&operands, false, |left, right| {
                left.binary(right, |a, b| a | b)
            })?,
            NodeKind::Nor => fold_gate(&operands, true, |left, right| {
                left.binary(right, |a, b| a | b)
            })?,
            NodeKind::Xor => fold_gate(&operands, false, |left, right| {
                left.binary(right, |a, b| a ^ b)
            })?,
            NodeKind::Xnor => fold_gate(&operands, true, |left, right| {
                left.binary(right, |a, b| a ^ b)
            })?,
            NodeKind::Not => unary(&node.id, &operands)?.not(),
            NodeKind::Output => unary(&node.id, &operands)?,
        };
        values.insert(id.clone(), signal);
    }

    let public_values = order
        .iter()
        .map(|id| {
            (
                id.clone(),
                *values.get(id).expect("evaluated in topological order"),
            )
        })
        .collect();
    let outputs = netlist
        .nodes
        .iter()
        .filter_map(|node| {
            matches!(node.kind, NodeKind::Output).then(|| {
                (
                    node.id.clone(),
                    *values.get(&node.id).expect("output evaluated"),
                )
            })
        })
        .collect();

    Ok(Evaluation {
        values: public_values,
        outputs,
        order,
    })
}

pub fn topological_order(netlist: &Netlist) -> Result<Vec<String>, EvalError> {
    let mut node_ids = HashSet::with_capacity(netlist.nodes.len());
    let mut dependencies: HashMap<&str, usize> = HashMap::with_capacity(netlist.nodes.len());
    let mut dependents: HashMap<&str, Vec<&str>> = HashMap::with_capacity(netlist.nodes.len());

    for node in &netlist.nodes {
        if !node_ids.insert(node.id.as_str()) {
            return Err(EvalError::DuplicateNode(node.id.clone()));
        }
        dependencies.insert(node.id.as_str(), 0);
    }

    for node in &netlist.nodes {
        for dependency in &node.inputs {
            if !node_ids.contains(dependency.as_str()) {
                return Err(EvalError::MissingNode {
                    node: node.id.clone(),
                    dependency: dependency.clone(),
                });
            }
            *dependencies
                .get_mut(node.id.as_str())
                .expect("node was registered") += 1;
            dependents
                .entry(dependency.as_str())
                .or_default()
                .push(node.id.as_str());
        }
    }

    for ids in dependents.values_mut() {
        ids.sort_unstable();
    }

    let mut ready: Vec<&str> = dependencies
        .iter()
        .filter_map(|(id, count)| (*count == 0).then_some(*id))
        .collect();
    ready.sort_unstable();
    let mut order = Vec::with_capacity(netlist.nodes.len());

    while let Some(id) = ready.first().copied() {
        ready.remove(0);
        order.push(id.to_owned());
        if let Some(targets) = dependents.get(id) {
            for target in targets {
                let remaining = dependencies.get_mut(target).expect("target was registered");
                *remaining -= 1;
                if *remaining == 0 {
                    let index = ready.binary_search(target).unwrap_or_else(|index| index);
                    ready.insert(index, target);
                }
            }
        }
    }

    if order.len() != netlist.nodes.len() {
        return Err(EvalError::Cycle);
    }
    Ok(order)
}

fn unary(node: &str, operands: &[Signal]) -> Result<Signal, EvalError> {
    operands
        .first()
        .copied()
        .ok_or_else(|| EvalError::MissingOperand {
            node: node.to_owned(),
        })
}

fn fold_gate(
    operands: &[Signal],
    invert: bool,
    operation: impl Fn(Signal, Signal) -> Result<Signal, EvalError>,
) -> Result<Signal, EvalError> {
    if operands.is_empty() {
        return Signal::zero(1);
    }
    let first = operands[0];
    let result = operands
        .iter()
        .skip(1)
        .copied()
        .try_fold(first, operation)?;
    Ok(if invert { result.not() } else { result })
}

fn mask(width: u8) -> u64 {
    if width == MAX_WIDTH {
        u64::MAX
    } else {
        (1u64 << width) - 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(width: u8, bits: u64) -> Signal {
        Signal::new(width, bits).unwrap()
    }

    #[test]
    fn exposes_only_the_versioned_wasm_readiness_marker() {
        assert_eq!(veritas_wasm_abi_version(), 1);
        assert_eq!(veritas_wasm_capabilities(), WASM_CAPABILITY_ABI_MARKER);
    }

    #[test]
    fn evaluates_deterministically_with_sorted_ready_queue() {
        let netlist = Netlist {
            nodes: vec![
                Node::input("b", s(1, 1)),
                Node::input("a", s(1, 0)),
                Node::gate("and", NodeKind::And, vec!["a".into(), "b".into()]),
                Node::gate("out", NodeKind::Output, vec!["and".into()]),
            ],
        };
        let result = evaluate(&netlist, &[]).unwrap();
        assert_eq!(result.order, vec!["a", "b", "and", "out"]);
        assert_eq!(result.output("out"), Some(s(1, 0)));
    }

    #[test]
    fn evaluates_all_three_new_gate_families_for_64_bits() {
        let netlist = Netlist {
            nodes: vec![
                Node::input("a", s(64, u64::MAX)),
                Node::input("b", s(64, 0x0f0f)),
                Node::gate("nand", NodeKind::Nand, vec!["a".into(), "b".into()]),
                Node::gate("nor", NodeKind::Nor, vec!["a".into(), "b".into()]),
                Node::gate("xnor", NodeKind::Xnor, vec!["a".into(), "b".into()]),
            ],
        };
        let result = evaluate(&netlist, &[]).unwrap();
        assert_eq!(result.value("nand"), Some(s(64, !0x0f0f_u64)));
        assert_eq!(result.value("nor"), Some(s(64, 0)));
        assert_eq!(result.value("xnor"), Some(s(64, 0x0f0f)));
    }

    #[test]
    fn rejects_cycles_and_missing_dependencies() {
        let cycle = Netlist {
            nodes: vec![
                Node::gate("a", NodeKind::Not, vec!["b".into()]),
                Node::gate("b", NodeKind::Not, vec!["a".into()]),
            ],
        };
        assert_eq!(evaluate(&cycle, &[]), Err(EvalError::Cycle));

        let missing = Netlist {
            nodes: vec![Node::gate("out", NodeKind::Output, vec!["unknown".into()])],
        };
        assert_eq!(
            topological_order(&missing),
            Err(EvalError::MissingNode {
                node: "out".into(),
                dependency: "unknown".into()
            })
        );
    }

    #[test]
    fn rejects_invalid_widths_and_values() {
        assert_eq!(Signal::new(0, 0), Err(EvalError::InvalidWidth(0)));
        assert_eq!(Signal::new(65, 0), Err(EvalError::InvalidWidth(65)));
        assert_eq!(
            Signal::new(4, 16),
            Err(EvalError::ValueDoesNotFit { width: 4, bits: 16 })
        );
    }

    #[test]
    fn accepts_explicit_input_overrides() {
        let netlist = Netlist {
            nodes: vec![Node::input("a", s(4, 1))],
        };
        let result = evaluate(&netlist, &[("a".into(), s(4, 9))]).unwrap();
        assert_eq!(result.value("a"), Some(s(4, 9)));
    }
}
