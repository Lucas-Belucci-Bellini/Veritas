use crate::{evaluate, EvalError, Netlist, Node, NodeKind, Signal};
use std::collections::{HashMap, HashSet};

pub const WASM_BUFFER_CAPACITY: usize = 65_536;

const MAGIC_VNET: &[u8; 4] = b"VNET";
const MAGIC_VRES: &[u8; 4] = b"VRES";
const FORMAT_VERSION: u8 = 1;
const KIND_INPUT: u8 = 0;
const KIND_CONSTANT: u8 = 1;
const KIND_AND: u8 = 2;
const KIND_NAND: u8 = 3;
const KIND_OR: u8 = 4;
const KIND_NOR: u8 = 5;
const KIND_XOR: u8 = 6;
const KIND_XNOR: u8 = 7;
const KIND_NOT: u8 = 8;
const KIND_OUTPUT: u8 = 9;

pub const ERROR_MAGIC: u32 = 1;
pub const ERROR_VERSION: u32 = 2;
pub const ERROR_WIDTH_OR_VALUE: u32 = 3;
pub const ERROR_PAYLOAD: u32 = 4;
pub const ERROR_SHAPE: u32 = 5;
pub const ERROR_REFERENCE: u32 = 6;
pub const ERROR_EVALUATION: u32 = 7;
pub const ERROR_RESULT: u32 = 8;

static mut BUFFER: [u8; WASM_BUFFER_CAPACITY] = [0; WASM_BUFFER_CAPACITY];
static mut LAST_ERROR_CODE: u32 = 0;

#[no_mangle]
pub extern "C" fn veritas_wasm_buffer_ptr() -> u32 {
    unsafe { std::ptr::addr_of_mut!(BUFFER) as *mut u8 as usize as u32 }
}

#[no_mangle]
pub extern "C" fn veritas_wasm_buffer_capacity() -> u32 {
    WASM_BUFFER_CAPACITY as u32
}

#[no_mangle]
pub extern "C" fn veritas_wasm_last_error_code() -> u32 {
    unsafe { LAST_ERROR_CODE }
}

#[no_mangle]
pub extern "C" fn veritas_wasm_evaluate(input_len: u32) -> u32 {
    let input_len = input_len as usize;
    if input_len > WASM_BUFFER_CAPACITY {
        set_error(ERROR_PAYLOAD);
        return 0;
    }

    let input = unsafe { &BUFFER[..input_len] }.to_vec();
    let result = decode_payload(&input)
        .and_then(|decoded| evaluate_decoded(decoded).map_err(|_| ERROR_EVALUATION))
        .and_then(|evaluated| encode_result(&evaluated));

    match result {
        Ok(output) if output.len() <= WASM_BUFFER_CAPACITY => {
            unsafe {
                BUFFER[..output.len()].copy_from_slice(&output);
                LAST_ERROR_CODE = 0;
            }
            output.len() as u32
        }
        Ok(_) => {
            set_error(ERROR_RESULT);
            0
        }
        Err(code) => {
            set_error(code);
            0
        }
    }
}

struct DecodedNetlist {
    width: u8,
    ids: Vec<String>,
    netlist: Netlist,
    overrides: Vec<(String, Signal)>,
}

struct RawNode {
    id: String,
    kind: u8,
    value: u64,
    input_indices: Vec<u16>,
}

struct EvaluatedNetlist {
    width: u8,
    ids: Vec<String>,
    evaluation: crate::Evaluation,
}

fn decode_payload(bytes: &[u8]) -> Result<DecodedNetlist, u32> {
    let mut cursor = Cursor::new(bytes);
    if cursor.take(4).map_err(|_| ERROR_MAGIC)? != MAGIC_VNET {
        return Err(ERROR_MAGIC);
    }
    if cursor.read_u8()? != FORMAT_VERSION {
        return Err(ERROR_VERSION);
    }
    let width = cursor.read_u8()?;
    if !(1..=64).contains(&width) {
        return Err(ERROR_WIDTH_OR_VALUE);
    }
    let node_count = cursor.read_u16()? as usize;
    if !(1..=4096).contains(&node_count) {
        return Err(ERROR_SHAPE);
    }

    let mut raw_nodes = Vec::with_capacity(node_count);
    let mut ids = Vec::with_capacity(node_count);
    let mut known_ids = HashSet::with_capacity(node_count);
    for _ in 0..node_count {
        let id_len = cursor.read_u8()? as usize;
        if id_len == 0 || id_len > 255 {
            return Err(ERROR_SHAPE);
        }
        let id_bytes = cursor.take(id_len).map_err(|_| ERROR_PAYLOAD)?;
        let id = String::from_utf8(id_bytes.to_vec()).map_err(|_| ERROR_SHAPE)?;
        if !known_ids.insert(id.clone()) {
            return Err(ERROR_SHAPE);
        }
        let kind = cursor.read_u8()?;
        if kind > KIND_OUTPUT {
            return Err(ERROR_SHAPE);
        }
        let value = cursor.read_u64()?;
        let input_count = cursor.read_u8()? as usize;
        let expected_arity = match kind {
            KIND_INPUT | KIND_CONSTANT => Some(0),
            KIND_NOT | KIND_OUTPUT => Some(1),
            _ => None,
        };
        if expected_arity.is_some_and(|arity| input_count != arity)
            || (expected_arity.is_none() && input_count == 0)
        {
            return Err(ERROR_SHAPE);
        }
        if matches!(kind, KIND_AND..=KIND_OUTPUT)
            && !matches!(kind, KIND_NOT | KIND_OUTPUT)
            && value != 0
        {
            return Err(ERROR_SHAPE);
        }
        let mut input_indices = Vec::with_capacity(input_count);
        for _ in 0..input_count {
            input_indices.push(cursor.read_u16()?);
        }
        ids.push(id.clone());
        raw_nodes.push(RawNode {
            id,
            kind,
            value,
            input_indices,
        });
    }

    let mut nodes = Vec::with_capacity(node_count);
    for raw in raw_nodes {
        let inputs = raw
            .input_indices
            .iter()
            .map(|index| ids.get(*index as usize).cloned().ok_or(ERROR_REFERENCE))
            .collect::<Result<Vec<_>, _>>()?;
        let kind = match raw.kind {
            KIND_INPUT => NodeKind::Input {
                initial: Signal::new(width, raw.value).map_err(|_| ERROR_WIDTH_OR_VALUE)?,
            },
            KIND_CONSTANT => NodeKind::Constant {
                value: Signal::new(width, raw.value).map_err(|_| ERROR_WIDTH_OR_VALUE)?,
            },
            KIND_AND => NodeKind::And,
            KIND_NAND => NodeKind::Nand,
            KIND_OR => NodeKind::Or,
            KIND_NOR => NodeKind::Nor,
            KIND_XOR => NodeKind::Xor,
            KIND_XNOR => NodeKind::Xnor,
            KIND_NOT => NodeKind::Not,
            KIND_OUTPUT => NodeKind::Output,
            _ => return Err(ERROR_SHAPE),
        };
        nodes.push(Node {
            id: raw.id,
            kind,
            inputs,
        });
    }

    let override_count = cursor.read_u16()? as usize;
    let mut overrides = Vec::with_capacity(override_count);
    let mut override_indices = HashSet::with_capacity(override_count);
    for _ in 0..override_count {
        let index = cursor.read_u16()? as usize;
        if index >= node_count || !override_indices.insert(index) {
            return Err(ERROR_REFERENCE);
        }
        if !matches!(nodes[index].kind, NodeKind::Input { .. }) {
            return Err(ERROR_REFERENCE);
        }
        let value = cursor.read_u64()?;
        let signal = Signal::new(width, value).map_err(|_| ERROR_WIDTH_OR_VALUE)?;
        overrides.push((ids[index].clone(), signal));
    }
    if !cursor.is_at_end() {
        return Err(ERROR_PAYLOAD);
    }

    Ok(DecodedNetlist {
        width,
        ids,
        netlist: Netlist { nodes },
        overrides,
    })
}

fn evaluate_decoded(decoded: DecodedNetlist) -> Result<EvaluatedNetlist, EvalError> {
    let evaluation = evaluate(&decoded.netlist, &decoded.overrides)?;
    Ok(EvaluatedNetlist {
        width: decoded.width,
        ids: decoded.ids,
        evaluation,
    })
}

fn encode_result(evaluated: &EvaluatedNetlist) -> Result<Vec<u8>, u32> {
    let node_count = evaluated.ids.len();
    if node_count > u16::MAX as usize {
        return Err(ERROR_RESULT);
    }
    let mut output = Vec::with_capacity(8 + node_count * 8 + 2 + node_count * 2);
    output.extend_from_slice(MAGIC_VRES);
    output.push(FORMAT_VERSION);
    output.push(evaluated.width);
    write_u16(&mut output, node_count as u16);
    for id in &evaluated.ids {
        let signal = evaluated.evaluation.value(id).ok_or(ERROR_RESULT)?;
        if signal.width != evaluated.width {
            return Err(ERROR_RESULT);
        }
        write_u64(&mut output, signal.bits);
    }
    write_u16(&mut output, node_count as u16);
    let indices: HashMap<&str, u16> = evaluated
        .ids
        .iter()
        .enumerate()
        .map(|(index, id)| (id.as_str(), index as u16))
        .collect();
    for id in &evaluated.evaluation.order {
        let index = indices.get(id.as_str()).copied().ok_or(ERROR_RESULT)?;
        write_u16(&mut output, index);
    }
    Ok(output)
}

fn set_error(code: u32) {
    unsafe {
        LAST_ERROR_CODE = code;
    }
}

struct Cursor<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> Cursor<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn take(&mut self, length: usize) -> Result<&'a [u8], u32> {
        let end = self.offset.checked_add(length).ok_or(ERROR_PAYLOAD)?;
        if end > self.bytes.len() {
            return Err(ERROR_PAYLOAD);
        }
        let result = &self.bytes[self.offset..end];
        self.offset = end;
        Ok(result)
    }

    fn read_u8(&mut self) -> Result<u8, u32> {
        Ok(*self.take(1)?.first().ok_or(ERROR_PAYLOAD)?)
    }

    fn read_u16(&mut self) -> Result<u16, u32> {
        let bytes = self.take(2)?;
        Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
    }

    fn read_u64(&mut self) -> Result<u64, u32> {
        let bytes = self.take(8)?;
        Ok(u64::from_le_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ]))
    }

    fn is_at_end(&self) -> bool {
        self.offset == self.bytes.len()
    }
}

fn write_u16(output: &mut Vec<u8>, value: u16) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn write_u64(output: &mut Vec<u8>, value: u64) {
    output.extend_from_slice(&value.to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(MAGIC_VNET);
        bytes.push(FORMAT_VERSION);
        bytes.push(1);
        write_u16(&mut bytes, 4);
        for (id, kind, value, inputs) in [
            ("b", KIND_INPUT, 1, Vec::new()),
            ("a", KIND_INPUT, 0, Vec::new()),
            ("and", KIND_AND, 0, vec![0, 1]),
            ("out", KIND_OUTPUT, 0, vec![2]),
        ] {
            bytes.push(id.len() as u8);
            bytes.extend_from_slice(id.as_bytes());
            bytes.push(kind);
            write_u64(&mut bytes, value);
            bytes.push(inputs.len() as u8);
            for input in inputs {
                write_u16(&mut bytes, input);
            }
        }
        write_u16(&mut bytes, 0);
        bytes
    }

    #[test]
    fn decodes_and_evaluates_versioned_payload() {
        let decoded = decode_payload(&payload()).unwrap();
        let evaluated = evaluate_decoded(decoded).unwrap();
        let result = encode_result(&evaluated).unwrap();
        assert_eq!(&result[..4], MAGIC_VRES);
        assert_eq!(result[4], FORMAT_VERSION);
        assert_eq!(result[5], 1);
        assert_eq!(u16::from_le_bytes([result[6], result[7]]), 4);
        assert_eq!(u64::from_le_bytes(result[8..16].try_into().unwrap()), 1);
        assert_eq!(u64::from_le_bytes(result[16..24].try_into().unwrap()), 0);
        assert_eq!(u64::from_le_bytes(result[24..32].try_into().unwrap()), 0);
        assert_eq!(u64::from_le_bytes(result[32..40].try_into().unwrap()), 0);
        assert_eq!(u16::from_le_bytes([result[40], result[41]]), 4);
        assert_eq!(result.len(), 50);
    }

    #[test]
    fn rejects_truncated_and_invalid_shapes() {
        assert!(matches!(
            decode_payload(&payload()[..payload().len() - 1]),
            Err(ERROR_PAYLOAD)
        ));
        let mut invalid = payload();
        invalid[4] = 2;
        assert!(matches!(decode_payload(&invalid), Err(ERROR_VERSION)));

        let mut invalid_arity = payload();
        invalid_arity[45] = 0;
        assert!(matches!(decode_payload(&invalid_arity), Err(ERROR_SHAPE)));

        let mut invalid_reference = payload();
        invalid_reference[46] = 99;
        assert!(matches!(
            decode_payload(&invalid_reference),
            Err(ERROR_REFERENCE)
        ));

        let mut invalid_value = payload();
        invalid_value[11] = 0;
        invalid_value[12] = 1;
        assert!(matches!(
            decode_payload(&invalid_value),
            Err(ERROR_WIDTH_OR_VALUE)
        ));

        let mut cycle = payload();
        cycle[46] = 2;
        assert!(matches!(
            evaluate_decoded(decode_payload(&cycle).unwrap()),
            Err(EvalError::Cycle)
        ));

        let mut duplicate_overrides = payload();
        duplicate_overrides[66] = 2;
        duplicate_overrides.extend_from_slice(&[0, 0]);
        duplicate_overrides.extend_from_slice(&[0; 8]);
        duplicate_overrides.extend_from_slice(&[0, 0]);
        duplicate_overrides.extend_from_slice(&[0; 8]);
        assert!(matches!(
            decode_payload(&duplicate_overrides),
            Err(ERROR_REFERENCE)
        ));
    }
}
