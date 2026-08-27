use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::{Duration, Instant};

pub const NATIVE_PROTOCOL_VERSION: u8 = 1;
pub const MAX_COMPONENTS: usize = 256;
pub const MAX_CONNECTIONS: usize = 512;
pub const MAX_SERIALIZED_BYTES: usize = 500_000;
pub const MAX_STEPS: usize = 256;
pub const MAX_TICKS: u64 = 1_000;
pub const MAX_WATCHES: usize = 128;
pub const MAX_NATIVE_PROGRESS_MESSAGES: u64 = 64;
pub const NATIVE_SIMULATION_PROGRESS_EVENT: &str = "veritas://simulation-progress";
pub const MAX_REQUEST_ID_LENGTH: usize = 128;
pub const DEFAULT_MAX_OPERATIONS: u64 = 1_000_000_000;
pub const MAX_OPERATIONS: u64 = 10_000_000_000;
pub const DEFAULT_MAX_MEMORY_BYTES: u64 = 64 * 1024 * 1024;
pub const MAX_MEMORY_BYTES: u64 = 512 * 1024 * 1024;
pub const DEFAULT_TIMEOUT_MS: u64 = 30_000;
pub const MAX_TIMEOUT_MS: u64 = 300_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativePortRef {
    pub node: String,
    #[serde(default)]
    pub port: Option<usize>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeComponentOptions {
    #[serde(default)]
    pub period: Option<u32>,
    #[serde(default)]
    pub ticks: Option<u32>,
    #[serde(default)]
    pub value: Option<bool>,
    #[serde(default)]
    pub initial: Option<bool>,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub widths: Option<Vec<u32>>,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(rename = "customChipId", default)]
    pub custom_chip_id: Option<u32>,
    #[serde(rename = "customChipBoundary", default)]
    pub custom_chip_boundary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeComponent {
    pub id: String,
    #[serde(rename = "type")]
    pub component_type: String,
    #[serde(default)]
    pub inputs: Vec<NativePortRef>,
    #[serde(default)]
    pub options: NativeComponentOptions,
    #[serde(default)]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeBudget {
    #[serde(rename = "maxTicks", default)]
    pub max_ticks: Option<u64>,
    #[serde(rename = "maxOperations", default)]
    pub max_operations: Option<u64>,
    #[serde(rename = "maxMemoryBytes", default)]
    pub max_memory_bytes: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeStep {
    #[serde(default)]
    pub set: BTreeMap<String, bool>,
    #[serde(default)]
    pub ticks: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeSimulationRequest {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u8,
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub components: Vec<NativeComponent>,
    pub steps: Vec<NativeStep>,
    #[serde(default)]
    pub watch: Vec<String>,
    #[serde(default)]
    pub budget: NativeBudget,
    #[serde(rename = "yieldEvery", default)]
    pub yield_every: Option<u64>,
    #[serde(rename = "timeoutMs", default)]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NativeSnapshot {
    pub tick: u64,
    pub values: BTreeMap<String, Vec<bool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NativeSimulationProgress {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u8,
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub snapshot: NativeSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NativeSimulationResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u8,
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub snapshots: Vec<NativeSnapshot>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct NativeSimulationError {
    pub code: String,
    pub message: String,
}

impl NativeSimulationError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
        }
    }

    fn invalid(message: impl Into<String>) -> Self {
        Self::new("invalid-request", message)
    }
    fn cancelled() -> Self {
        Self::new("cancelled", "A execução foi cancelada cooperativamente.")
    }
    fn timeout(timeout_ms: u64) -> Self {
        Self::new(
            "timeout",
            format!("A execução excedeu o timeout de {timeout_ms} ms."),
        )
    }
    fn budget(message: impl Into<String>) -> Self {
        Self::new("document-budget", message)
    }
    fn operations(message: impl Into<String>) -> Self {
        Self::new("operation-budget", message)
    }
    fn execution(message: impl Into<String>) -> Self {
        Self::new("execution", message)
    }
}

#[derive(Debug, Clone, Copy)]
struct Limits {
    max_ticks: u64,
    max_operations: u64,
    max_memory_bytes: u64,
    timeout_ms: u64,
}

#[derive(Debug, Clone)]
struct Node {
    component: NativeComponent,
    outputs: Vec<bool>,
    next: Vec<bool>,
    last_clock: bool,
    next_last_clock: bool,
    queue: Vec<bool>,
    next_queue: Vec<bool>,
    counter: u32,
    next_counter: u32,
}

#[derive(Debug, Clone)]
struct NativeSimulator {
    nodes: HashMap<String, Node>,
    order: Vec<String>,
    watch: Vec<String>,
    limits: Limits,
    ticks: u64,
    operations: u64,
    started_at: Instant,
}

pub fn execute_native(
    request: NativeSimulationRequest,
    cancel: Arc<AtomicBool>,
) -> Result<NativeSimulationResult, NativeSimulationError> {
    execute_native_with_progress(request, cancel, |_| Ok(()))
}

pub fn execute_native_with_progress(
    request: NativeSimulationRequest,
    cancel: Arc<AtomicBool>,
    mut emit: impl FnMut(NativeSimulationProgress) -> Result<(), NativeSimulationError>,
) -> Result<NativeSimulationResult, NativeSimulationError> {
    let (request, limits) = validate_request(request)?;
    let watch = if request.watch.is_empty() {
        request
            .components
            .iter()
            .map(|component| component.id.clone())
            .collect()
    } else {
        request.watch.clone()
    };
    let mut simulator = NativeSimulator::new(&request.components, watch, limits)?;
    let mut snapshots = vec![simulator.snapshot()];
    let total_ticks: u64 = request
        .steps
        .iter()
        .map(|step| step.ticks.unwrap_or(1))
        .sum();
    let progress_stride =
        (total_ticks.max(1) + MAX_NATIVE_PROGRESS_MESSAGES - 1) / MAX_NATIVE_PROGRESS_MESSAGES;
    let yield_every = request.yield_every.unwrap_or(1);
    let mut completed_ticks = 0u64;

    for step in &request.steps {
        for (id, value) in &step.set {
            simulator.set_input(id, *value, &cancel)?;
        }
        for _ in 0..step.ticks.unwrap_or(1) {
            simulator.tick(&cancel)?;
            snapshots.push(simulator.snapshot());
            completed_ticks += 1;
            if completed_ticks % yield_every == 0 {
                std::thread::yield_now();
            }
            if completed_ticks % progress_stride == 0 || completed_ticks == total_ticks {
                emit(NativeSimulationProgress {
                    protocol_version: NATIVE_PROTOCOL_VERSION,
                    request_id: request.request_id.clone(),
                    snapshot: simulator.snapshot(),
                })?;
            }
        }
    }

    Ok(NativeSimulationResult {
        protocol_version: NATIVE_PROTOCOL_VERSION,
        request_id: request.request_id,
        snapshots,
    })
}

fn validate_request(
    mut request: NativeSimulationRequest,
) -> Result<(NativeSimulationRequest, Limits), NativeSimulationError> {
    if request.protocol_version != NATIVE_PROTOCOL_VERSION {
        return Err(NativeSimulationError::invalid(format!(
            "protocolVersion deve ser {NATIVE_PROTOCOL_VERSION}."
        )));
    }
    if request.request_id.is_empty() || request.request_id.len() > MAX_REQUEST_ID_LENGTH {
        return Err(NativeSimulationError::invalid(
            "requestId ausente ou acima do limite.",
        ));
    }
    if request.components.is_empty() || request.components.len() > MAX_COMPONENTS {
        return Err(NativeSimulationError::invalid(format!(
            "components deve conter entre 1 e {MAX_COMPONENTS} itens."
        )));
    }
    if request.steps.len() > MAX_STEPS {
        return Err(NativeSimulationError::invalid(format!(
            "steps deve conter no máximo {MAX_STEPS} itens."
        )));
    }
    let serialized = serde_json::to_vec(&request)
        .map_err(|_| NativeSimulationError::invalid("request não é serializável."))?;
    if serialized.len() > MAX_SERIALIZED_BYTES {
        return Err(NativeSimulationError::invalid(format!(
            "request excede {MAX_SERIALIZED_BYTES} bytes."
        )));
    }

    let mut ids = HashSet::new();
    let mut connections = 0usize;
    for component in &request.components {
        if component.id.is_empty() || component.id.len() > 200 || !ids.insert(component.id.clone())
        {
            return Err(NativeSimulationError::invalid(
                "Cada componente deve possuir id único e bounded.",
            ));
        }
        if !is_supported_type(&component.component_type) {
            return Err(NativeSimulationError::invalid(format!(
                "Tipo de componente inválido em \"{}\".",
                component.id
            )));
        }
        if matches!(
            component.component_type.as_str(),
            "custom-chip" | "splitter" | "combiner"
        ) {
            return Err(NativeSimulationError::invalid(
                "O comando nativo inicial aceita somente netlists escalares.",
            ));
        }
        if component.options.width.is_some() || component.options.widths.is_some() {
            return Err(NativeSimulationError::invalid(
                "Larguras vetoriais ainda não são suportadas pelo comando nativo.",
            ));
        }
        if component.options.custom_chip_id.is_some()
            || component.options.custom_chip_boundary.is_some()
        {
            return Err(NativeSimulationError::invalid(
                "Opções de custom-chip não são aceitas no comando nativo escalar.",
            ));
        }
        if component
            .label
            .as_ref()
            .is_some_and(|label| label.len() > 120)
        {
            return Err(NativeSimulationError::invalid(format!(
                "label inválido em \"{}\".",
                component.id
            )));
        }
        if component
            .options
            .period
            .is_some_and(|period| !(1..=64).contains(&period))
        {
            return Err(NativeSimulationError::invalid(
                "period deve estar entre 1 e 64.",
            ));
        }
        if component
            .options
            .ticks
            .is_some_and(|ticks| !(1..=MAX_TICKS as u32).contains(&ticks))
        {
            return Err(NativeSimulationError::invalid(format!(
                "ticks deve estar entre 1 e {MAX_TICKS}."
            )));
        }
        connections += component.inputs.len();
        if connections > MAX_CONNECTIONS {
            return Err(NativeSimulationError::invalid(format!(
                "A mensagem excede {MAX_CONNECTIONS} conexões."
            )));
        }
    }

    let component_map: HashMap<_, _> = request
        .components
        .iter()
        .map(|component| (component.id.as_str(), component))
        .collect();
    for component in &request.components {
        for input in &component.inputs {
            let target = component_map.get(input.node.as_str()).ok_or_else(|| {
                NativeSimulationError::invalid(format!(
                    "A ligação aponta para \"{}\", que não existe.",
                    input.node
                ))
            })?;
            let port = input.port.unwrap_or(0);
            if port >= output_count(&target.component_type) {
                return Err(NativeSimulationError::invalid(format!(
                    "\"{}\" não possui a saída {port}.",
                    input.node
                )));
            }
        }
    }

    if request
        .yield_every
        .is_some_and(|yield_every| !(1..=1_000).contains(&yield_every))
    {
        return Err(NativeSimulationError::invalid(
            "yieldEvery deve estar entre 1 e 1000.",
        ));
    }
    if request.watch.len() > MAX_WATCHES {
        return Err(NativeSimulationError::invalid(format!(
            "watch deve conter no máximo {MAX_WATCHES} itens."
        )));
    }
    for id in &request.watch {
        if !ids.contains(id) {
            return Err(NativeSimulationError::invalid(format!(
                "Watches inexistentes: {id}."
            )));
        }
    }
    let total_ticks: u64 = request
        .steps
        .iter()
        .map(|step| step.ticks.unwrap_or(1))
        .try_fold(0u64, |total, ticks| total.checked_add(ticks))
        .ok_or_else(|| {
            NativeSimulationError::invalid("A soma de tiques excede o limite numérico.")
        })?;
    if total_ticks > MAX_TICKS {
        return Err(NativeSimulationError::invalid(format!(
            "A execução excede o limite nativo de {MAX_TICKS} tiques."
        )));
    }
    for step in &request.steps {
        if step.ticks.is_some_and(|ticks| ticks > MAX_TICKS) {
            return Err(NativeSimulationError::invalid(format!(
                "ticks deve ser no máximo {MAX_TICKS}."
            )));
        }
        for id in step.set.keys() {
            if !ids.contains(id) {
                return Err(NativeSimulationError::invalid(format!(
                    "Entrada inexistente em step: {id}."
                )));
            }
        }
    }

    let limits = Limits {
        max_ticks: request.budget.max_ticks.unwrap_or(MAX_TICKS),
        max_operations: request
            .budget
            .max_operations
            .unwrap_or(DEFAULT_MAX_OPERATIONS),
        max_memory_bytes: request
            .budget
            .max_memory_bytes
            .unwrap_or(DEFAULT_MAX_MEMORY_BYTES),
        timeout_ms: request.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS),
    };
    if limits.max_ticks == 0 || limits.max_ticks > MAX_TICKS {
        return Err(NativeSimulationError::invalid(format!(
            "maxTicks deve estar entre 1 e {MAX_TICKS}."
        )));
    }
    if limits.max_operations == 0 || limits.max_operations > MAX_OPERATIONS {
        return Err(NativeSimulationError::invalid(format!(
            "maxOperations deve estar entre 1 e {MAX_OPERATIONS}."
        )));
    }
    if limits.max_memory_bytes < 1024 || limits.max_memory_bytes > MAX_MEMORY_BYTES {
        return Err(NativeSimulationError::invalid(format!(
            "maxMemoryBytes deve estar entre 1024 e {MAX_MEMORY_BYTES}."
        )));
    }
    if limits.timeout_ms == 0 || limits.timeout_ms > MAX_TIMEOUT_MS {
        return Err(NativeSimulationError::invalid(format!(
            "timeoutMs deve estar entre 1 e {MAX_TIMEOUT_MS}."
        )));
    }
    if total_ticks > limits.max_ticks {
        return Err(NativeSimulationError::budget(format!(
            "A execução excederia o orçamento de {} tiques.",
            limits.max_ticks
        )));
    }

    // Ordenação dos componentes é preservada como parte da semântica canônica.
    request.components.shrink_to_fit();
    Ok((request, limits))
}

fn is_supported_type(component_type: &str) -> bool {
    matches!(
        component_type,
        "input"
            | "output"
            | "constant"
            | "and"
            | "or"
            | "not"
            | "nand"
            | "nor"
            | "xor"
            | "xnor"
            | "clock"
            | "dff"
            | "tff"
            | "jk"
            | "sr"
            | "delay"
            | "transmitter"
            | "receiver"
    )
}

fn output_count(component_type: &str) -> usize {
    matches!(component_type, "dff" | "tff" | "jk" | "sr")
        .then_some(2)
        .unwrap_or(1)
}

fn estimate_memory(components: &[NativeComponent]) -> u64 {
    let mut estimate = 128u64;
    for component in components {
        let outputs = output_count(&component.component_type) as u64;
        let inputs = component.inputs.len() as u64;
        let delay_ticks = if component.component_type == "delay" {
            component.options.ticks.unwrap_or(1) as u64
        } else {
            0
        };
        estimate = estimate.saturating_add(
            512 + outputs * 16
                + inputs * 32
                + delay_ticks * 8
                + (component.id.len() + component.label.as_ref().map_or(0, String::len)) as u64 * 2,
        );
    }
    estimate
}

impl NativeSimulator {
    fn new(
        components: &[NativeComponent],
        watch: Vec<String>,
        limits: Limits,
    ) -> Result<Self, NativeSimulationError> {
        let memory_estimate = estimate_memory(components);
        if memory_estimate > limits.max_memory_bytes {
            return Err(NativeSimulationError::budget(format!("O runtime exigiria aproximadamente {memory_estimate} bytes, acima do orçamento de memória.")));
        }
        let mut nodes = HashMap::new();
        let mut order = Vec::with_capacity(components.len());
        for component in components {
            let outputs_count = output_count(&component.component_type);
            let initial = component.options.initial.unwrap_or(false);
            let initial_value = if component.component_type == "constant" {
                component.options.value.unwrap_or(false)
            } else {
                initial
            };
            let mut outputs = vec![false; outputs_count];
            outputs[0] = initial_value;
            if outputs_count > 1 {
                outputs[1] = !initial_value;
            }
            let extra = if component.component_type == "delay" {
                component.options.ticks.unwrap_or(1).max(1) - 1
            } else {
                0
            };
            let queue = vec![false; extra as usize];
            order.push(component.id.clone());
            nodes.insert(
                component.id.clone(),
                Node {
                    component: component.clone(),
                    outputs: outputs.clone(),
                    next: outputs,
                    last_clock: false,
                    next_last_clock: false,
                    queue: queue.clone(),
                    next_queue: queue,
                    counter: 0,
                    next_counter: 0,
                },
            );
        }
        Ok(Self {
            nodes,
            order,
            watch,
            limits,
            ticks: 0,
            operations: 0,
            started_at: Instant::now(),
        })
    }

    fn set_input(
        &mut self,
        id: &str,
        value: bool,
        cancel: &Arc<AtomicBool>,
    ) -> Result<(), NativeSimulationError> {
        self.ensure_running(cancel)?;
        let node = self.nodes.get_mut(id).ok_or_else(|| {
            NativeSimulationError::invalid(format!("Componente inexistente: {id}."))
        })?;
        if node.component.component_type != "input" {
            return Err(NativeSimulationError::invalid(format!(
                "\"{id}\" não é um pino de entrada."
            )));
        }
        node.outputs[0] = value;
        node.next[0] = value;
        Ok(())
    }

    fn tick(&mut self, cancel: &Arc<AtomicBool>) -> Result<(), NativeSimulationError> {
        self.ensure_running(cancel)?;
        if self.ticks >= self.limits.max_ticks {
            return Err(NativeSimulationError::budget(format!(
                "O simulador excederia o orçamento total de {} tiques.",
                self.limits.max_ticks
            )));
        }
        let operations_needed = (self.order.len() as u64).saturating_mul(2);
        if self.operations.saturating_add(operations_needed) > self.limits.max_operations {
            return Err(NativeSimulationError::operations(format!(
                "O simulador excederia o orçamento total de {} operações.",
                self.limits.max_operations
            )));
        }
        self.evaluate(cancel)?;
        self.propagate(cancel)?;
        self.ticks += 1;
        self.operations += operations_needed;
        Ok(())
    }

    fn evaluate(&mut self, cancel: &Arc<AtomicBool>) -> Result<(), NativeSimulationError> {
        for id in self.order.clone() {
            self.ensure_running(cancel)?;
            let node = self
                .nodes
                .get(&id)
                .ok_or_else(|| NativeSimulationError::execution("Estado de componente ausente."))?
                .clone();
            let values: Vec<bool> = node
                .component
                .inputs
                .iter()
                .map(|input| {
                    self.nodes
                        .get(&input.node)
                        .and_then(|source| source.outputs.get(input.port.unwrap_or(0)).copied())
                        .unwrap_or(false)
                })
                .collect();
            let (next, next_last_clock, next_counter, next_queue) = compute_next(&node, &values);
            let target = self
                .nodes
                .get_mut(&id)
                .ok_or_else(|| NativeSimulationError::execution("Estado de componente ausente."))?;
            target.next = next;
            target.next_last_clock = next_last_clock;
            target.next_counter = next_counter;
            target.next_queue = next_queue;
        }
        Ok(())
    }

    fn propagate(&mut self, cancel: &Arc<AtomicBool>) -> Result<(), NativeSimulationError> {
        for id in self.order.clone() {
            self.ensure_running(cancel)?;
            let target = self
                .nodes
                .get_mut(&id)
                .ok_or_else(|| NativeSimulationError::execution("Estado de componente ausente."))?;
            target.outputs = target.next.clone();
            target.last_clock = target.next_last_clock;
            target.counter = target.next_counter;
            target.queue = target.next_queue.clone();
        }
        Ok(())
    }

    fn snapshot(&self) -> NativeSnapshot {
        let mut values = BTreeMap::new();
        for id in &self.watch {
            if let Some(node) = self.nodes.get(id) {
                values.insert(id.clone(), vec![node.outputs[0]]);
            }
        }
        NativeSnapshot {
            tick: self.ticks,
            values,
        }
    }

    fn ensure_running(&self, cancel: &Arc<AtomicBool>) -> Result<(), NativeSimulationError> {
        if cancel.load(Ordering::Relaxed) {
            return Err(NativeSimulationError::cancelled());
        }
        if self.started_at.elapsed() >= Duration::from_millis(self.limits.timeout_ms) {
            return Err(NativeSimulationError::timeout(self.limits.timeout_ms));
        }
        Ok(())
    }
}

fn compute_next(node: &Node, values: &[bool]) -> (Vec<bool>, bool, u32, Vec<bool>) {
    let component_type = node.component.component_type.as_str();
    let mut next = node.next.clone();
    let mut next_last_clock = false;
    let mut next_counter = 0;
    let mut next_queue = node.queue.clone();
    let combinational = match component_type {
        "and" => Some(!values.is_empty() && values.iter().all(|value| *value)),
        "or" => Some(!values.is_empty() && values.iter().any(|value| *value)),
        "not" => Some(if values.is_empty() { false } else { !values[0] }),
        "nand" => Some(!values.is_empty() && !values.iter().all(|value| *value)),
        "nor" => Some(!values.is_empty() && !values.iter().any(|value| *value)),
        "xor" => Some(values.iter().filter(|value| **value).count() % 2 == 1),
        "xnor" => {
            Some(!values.is_empty() && values.iter().filter(|value| **value).count() % 2 == 0)
        }
        _ => None,
    };
    if let Some(value) = combinational {
        next[0] = value;
        return (next, next_last_clock, next_counter, next_queue);
    }

    match component_type {
        "input" => next[0] = node.outputs[0],
        "constant" => next[0] = node.component.options.value.unwrap_or(false),
        "output" | "transmitter" | "receiver" => next[0] = values.first().copied().unwrap_or(false),
        "clock" => {
            let period = node.component.options.period.unwrap_or(1).max(1);
            let counter = node.counter + 1;
            if counter >= period {
                next[0] = !node.outputs[0];
                next_counter = 0;
            } else {
                next[0] = node.outputs[0];
                next_counter = counter;
            }
        }
        "dff" | "tff" | "jk" | "sr" => {
            let clock_index = if matches!(component_type, "dff" | "tff") {
                1
            } else {
                2
            };
            let clock = values.get(clock_index).copied().unwrap_or(false);
            let rising = clock && !node.last_clock;
            next_last_clock = clock;
            let current = node.outputs[0];
            let stored = if !rising {
                current
            } else if component_type == "dff" {
                values.first().copied().unwrap_or(false)
            } else if component_type == "tff" {
                if values.first().copied().unwrap_or(false) {
                    !current
                } else {
                    current
                }
            } else if component_type == "jk" {
                let j = values.first().copied().unwrap_or(false);
                let k = values.get(1).copied().unwrap_or(false);
                if j && k {
                    !current
                } else if j {
                    true
                } else if k {
                    false
                } else {
                    current
                }
            } else {
                let set = values.first().copied().unwrap_or(false);
                let reset = values.get(1).copied().unwrap_or(false);
                if set && reset {
                    current
                } else if set {
                    true
                } else if reset {
                    false
                } else {
                    current
                }
            };
            next[0] = stored;
            next[1] = !stored;
        }
        "delay" => {
            let extra = node.component.options.ticks.unwrap_or(1).max(1) - 1;
            if extra == 0 {
                next[0] = values.first().copied().unwrap_or(false);
            } else {
                let mut queue = node.queue.clone();
                while queue.len() < extra as usize {
                    queue.insert(0, false);
                }
                queue.push(values.first().copied().unwrap_or(false));
                next[0] = queue.remove(0);
                next_queue = queue;
            }
        }
        _ => {}
    }
    (next, next_last_clock, next_counter, next_queue)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dff_request() -> NativeSimulationRequest {
        NativeSimulationRequest {
            protocol_version: 1,
            request_id: "native-dff".to_string(),
            components: vec![
                NativeComponent {
                    id: "d".to_string(),
                    component_type: "input".to_string(),
                    inputs: vec![],
                    options: NativeComponentOptions::default(),
                    label: None,
                },
                NativeComponent {
                    id: "clk".to_string(),
                    component_type: "clock".to_string(),
                    inputs: vec![],
                    options: NativeComponentOptions {
                        period: Some(1),
                        ..Default::default()
                    },
                    label: None,
                },
                NativeComponent {
                    id: "ff".to_string(),
                    component_type: "dff".to_string(),
                    inputs: vec![
                        NativePortRef {
                            node: "d".to_string(),
                            port: None,
                        },
                        NativePortRef {
                            node: "clk".to_string(),
                            port: None,
                        },
                    ],
                    options: NativeComponentOptions::default(),
                    label: None,
                },
                NativeComponent {
                    id: "qout".to_string(),
                    component_type: "output".to_string(),
                    inputs: vec![NativePortRef {
                        node: "ff".to_string(),
                        port: None,
                    }],
                    options: NativeComponentOptions::default(),
                    label: None,
                },
            ],
            steps: vec![
                NativeStep {
                    set: BTreeMap::from([(String::from("d"), true)]),
                    ticks: Some(1),
                },
                NativeStep {
                    set: BTreeMap::new(),
                    ticks: Some(1),
                },
                NativeStep {
                    set: BTreeMap::from([(String::from("d"), false)]),
                    ticks: Some(1),
                },
                NativeStep {
                    set: BTreeMap::new(),
                    ticks: Some(1),
                },
            ],
            watch: vec![
                "d".to_string(),
                "clk".to_string(),
                "ff".to_string(),
                "qout".to_string(),
            ],
            budget: NativeBudget::default(),
            yield_every: Some(1),
            timeout_ms: Some(30_000),
        }
    }

    #[derive(Debug, Deserialize)]
    struct SharedFixture {
        request: NativeSimulationRequest,
        #[serde(rename = "expectedSnapshots")]
        expected_snapshots: Vec<NativeSnapshot>,
    }

    #[test]
    fn matches_shared_typescript_golden_fixture() {
        let fixture: SharedFixture = serde_json::from_str(include_str!(
            "../../tests/fixtures/worker-sequential-dff.json"
        ))
        .expect("shared fixture should parse");
        let result = execute_native(fixture.request, Arc::new(AtomicBool::new(false)))
            .expect("shared fixture should execute");
        assert_eq!(result.snapshots, fixture.expected_snapshots);
    }

    #[test]
    fn matches_shared_typescript_tff_golden_fixture() {
        let fixture: SharedFixture = serde_json::from_str(include_str!(
            "../../tests/fixtures/worker-sequential-tff.json"
        ))
        .expect("shared TFF fixture should parse");
        let result = execute_native(fixture.request, Arc::new(AtomicBool::new(false)))
            .expect("shared TFF fixture should execute");
        assert_eq!(result.snapshots, fixture.expected_snapshots);
    }

    #[test]
    fn emits_bounded_progress_with_matching_request_id() {
        let mut request = dff_request();
        request.steps = vec![NativeStep {
            set: BTreeMap::new(),
            ticks: Some(1_000),
        }];
        let mut progress = Vec::new();
        let result =
            execute_native_with_progress(request, Arc::new(AtomicBool::new(false)), |event| {
                progress.push(event);
                Ok(())
            })
            .expect("request should execute");
        assert_eq!(
            result.snapshots.last().map(|snapshot| snapshot.tick),
            Some(1_000)
        );
        assert!(!progress.is_empty());
        assert!(progress.len() <= MAX_NATIVE_PROGRESS_MESSAGES as usize);
        assert!(progress
            .iter()
            .all(|event| event.request_id == "native-dff"));
        assert_eq!(
            progress.last().map(|event| event.snapshot.tick),
            Some(1_000)
        );
    }

    #[test]
    fn cancels_between_progress_callbacks() {
        let mut request = dff_request();
        request.steps = vec![NativeStep {
            set: BTreeMap::new(),
            ticks: Some(1_000),
        }];
        let cancel = Arc::new(AtomicBool::new(false));
        let callback_cancel = cancel.clone();
        let result = execute_native_with_progress(request, cancel, move |_| {
            callback_cancel.store(true, Ordering::Relaxed);
            Ok(())
        })
        .expect_err("callback cancellation should stop execution");
        assert_eq!(result.code, "cancelled");
    }

    #[test]
    fn observes_external_cancellation_between_yields() {
        use std::sync::mpsc;
        use std::thread;

        let mut request = dff_request();
        request.steps = vec![NativeStep {
            set: BTreeMap::new(),
            ticks: Some(1_000),
        }];
        request.yield_every = Some(1);
        let cancel = Arc::new(AtomicBool::new(false));
        let controller_cancel = cancel.clone();
        let (ready_tx, ready_rx) = mpsc::channel();
        let controller = thread::spawn(move || {
            ready_rx.recv().expect("engine should report progress");
            controller_cancel.store(true, Ordering::Relaxed);
        });
        let mut progress_count = 0usize;
        let result = execute_native_with_progress(request, cancel, |event| {
            progress_count += 1;
            if progress_count == 1 {
                ready_tx
                    .send(event.snapshot.tick)
                    .expect("controller should be alive");
            }
            Ok(())
        })
        .expect_err("external cancellation should stop execution");
        controller.join().expect("controller should finish");
        assert_eq!(result.code, "cancelled");
        assert!(progress_count >= 1);
        assert!(progress_count < MAX_NATIVE_PROGRESS_MESSAGES as usize);
    }

    #[test]
    fn executes_dff_deterministically() {
        let result = execute_native(dff_request(), Arc::new(AtomicBool::new(false)))
            .expect("request should execute");
        assert_eq!(
            result
                .snapshots
                .iter()
                .map(|snapshot| snapshot.tick)
                .collect::<Vec<_>>(),
            vec![0, 1, 2, 3, 4]
        );
        assert_eq!(result.snapshots[2].values["ff"], vec![true]);
        assert_eq!(result.snapshots[4].values["ff"], vec![false]);
    }

    #[test]
    fn rejects_vectors_and_unknown_fields_at_deserialization_boundary() {
        let vector = serde_json::from_value::<NativeSimulationRequest>(serde_json::json!({
            "protocolVersion": 1, "requestId": "vector", "components": [{"id": "bus", "type": "input", "options": {"width": 4}}], "steps": []
        })).expect("DTO should deserialize before semantic validation");
        let vector_error = execute_native(vector, Arc::new(AtomicBool::new(false)))
            .expect_err("vector must fail closed");
        assert_eq!(vector_error.code, "invalid-request");
        assert!(serde_json::from_value::<NativeSimulationRequest>(serde_json::json!({
            "protocolVersion": 1, "requestId": "unknown", "components": [{"id": "a", "type": "input", "unexpected": true}], "steps": []
        })).is_err());
    }

    #[test]
    fn rejects_budget_and_cancel_before_work() {
        let mut request = dff_request();
        request.budget.max_ticks = Some(1);
        let budget = execute_native(request, Arc::new(AtomicBool::new(false)))
            .expect_err("budget must fail before execution");
        assert_eq!(budget.code, "document-budget");

        let cancel = Arc::new(AtomicBool::new(true));
        let cancelled = execute_native(dff_request(), cancel).expect_err("cancel must fail closed");
        assert_eq!(cancelled.code, "cancelled");
    }
}
