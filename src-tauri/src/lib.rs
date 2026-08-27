pub mod simulation;

use std::collections::HashMap;
use std::sync::{atomic::AtomicBool, Arc, Mutex};
use std::time::Duration;
use tauri::Manager;

const NATIVE_SMOKE_REQUEST_ID: &str = "desktop-native-smoke";
const NATIVE_SMOKE_MARKER_FILE: &str = "veritas-native-smoke-v1.json";

#[derive(Debug, PartialEq, Eq)]
pub enum NativeRegistryError {
    Unavailable,
    Duplicate,
    Missing,
}

#[derive(Default)]
pub struct NativeCancellationRegistry {
    requests: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl NativeCancellationRegistry {
    fn register(
        &self,
        request_id: &str,
        cancel: Arc<AtomicBool>,
    ) -> Result<NativeRequestCleanup<'_>, NativeRegistryError> {
        let mut requests = self
            .requests
            .lock()
            .map_err(|_| NativeRegistryError::Unavailable)?;
        if requests.contains_key(request_id) {
            return Err(NativeRegistryError::Duplicate);
        }
        requests.insert(request_id.to_owned(), cancel);
        Ok(NativeRequestCleanup {
            registry: self,
            request_id: request_id.to_owned(),
        })
    }

    fn cancel(&self, request_id: &str) -> Result<(), NativeRegistryError> {
        let requests = self
            .requests
            .lock()
            .map_err(|_| NativeRegistryError::Unavailable)?;
        let cancel = requests
            .get(request_id)
            .ok_or(NativeRegistryError::Missing)?;
        cancel.store(true, std::sync::atomic::Ordering::Relaxed);
        Ok(())
    }

    fn remove(&self, request_id: &str) {
        if let Ok(mut requests) = self.requests.lock() {
            requests.remove(request_id);
        }
    }
}

struct NativeRequestCleanup<'a> {
    registry: &'a NativeCancellationRegistry,
    request_id: String,
}

impl Drop for NativeRequestCleanup<'_> {
    fn drop(&mut self) {
        self.registry.remove(&self.request_id);
    }
}

pub mod commands {
    use super::{
        Arc, AtomicBool, NativeCancellationRegistry, NativeRegistryError, NATIVE_SMOKE_MARKER_FILE,
        NATIVE_SMOKE_REQUEST_ID,
    };
    use crate::simulation::{
        execute_native_with_progress, NativeSimulationError, NativeSimulationRequest,
        NativeSimulationResult, NATIVE_SIMULATION_PROGRESS_EVENT,
    };
    use serde::Serialize;
    use tauri::{Emitter, State};

    fn map_registry_error(error: NativeRegistryError) -> NativeSimulationError {
        match error {
            NativeRegistryError::Unavailable => NativeSimulationError::new(
                "execution",
                "O registro de cancelamento está indisponível.",
            ),
            NativeRegistryError::Duplicate => NativeSimulationError::new(
                "invalid-request",
                "Já existe uma execução nativa com esse requestId.",
            ),
            NativeRegistryError::Missing => NativeSimulationError::new(
                "invalid-request",
                "Não existe execução nativa ativa para esse requestId.",
            ),
        }
    }

    pub(crate) async fn simulate_circuit_native_for_runtime<R: tauri::Runtime>(
        request: NativeSimulationRequest,
        registry: State<'_, NativeCancellationRegistry>,
        app: tauri::AppHandle<R>,
    ) -> Result<NativeSimulationResult, NativeSimulationError> {
        let cancel = Arc::new(AtomicBool::new(false));
        let native_cancel_smoke_enabled = native_smoke_mode() == "cancel";
        let _cleanup = registry
            .register(&request.request_id, cancel.clone())
            .map_err(map_registry_error)?;

        tauri::async_runtime::spawn_blocking(move || {
            if native_cancel_smoke_enabled {
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
            execute_native_with_progress(request, cancel, |progress| {
                app.emit(NATIVE_SIMULATION_PROGRESS_EVENT, progress)
                    .map_err(|error| {
                        NativeSimulationError::new(
                            "execution",
                            format!("Falha ao emitir progresso nativo: {error}"),
                        )
                    })
            })
        })
        .await
        .map_err(|_| {
            NativeSimulationError::new(
                "execution",
                "A execução nativa foi encerrada inesperadamente.",
            )
        })?
    }

    #[tauri::command]
    pub async fn simulate_circuit_native(
        request: NativeSimulationRequest,
        registry: State<'_, NativeCancellationRegistry>,
        app: tauri::AppHandle,
    ) -> Result<NativeSimulationResult, NativeSimulationError> {
        simulate_circuit_native_for_runtime(request, registry, app).await
    }

    #[tauri::command]
    pub fn cancel_circuit_native(
        request_id: String,
        registry: State<'_, NativeCancellationRegistry>,
    ) -> Result<(), NativeSimulationError> {
        registry.cancel(&request_id).map_err(map_registry_error)
    }

    #[derive(Serialize)]
    struct NativeSmokeMarker {
        #[serde(rename = "protocolVersion")]
        protocol_version: u8,
        #[serde(rename = "requestId")]
        request_id: String,
        #[serde(rename = "progressEvents")]
        progress_events: u64,
        #[serde(rename = "snapshotCount")]
        snapshot_count: u64,
    }

    #[derive(Serialize)]
    struct NativeSmokeCancelMarker {
        #[serde(rename = "protocolVersion")]
        protocol_version: u8,
        #[serde(rename = "requestId")]
        request_id: String,
        status: &'static str,
        #[serde(rename = "cancelResult")]
        cancel_result: String,
        #[serde(rename = "outcomeCode")]
        outcome_code: String,
        #[serde(rename = "progressEvents")]
        progress_events: u64,
        #[serde(rename = "lateProgressEvents")]
        late_progress_events: u64,
    }

    #[derive(Serialize)]
    struct NativeSmokeErrorMarker {
        #[serde(rename = "protocolVersion")]
        protocol_version: u8,
        #[serde(rename = "requestId")]
        request_id: String,
        status: &'static str,
        #[serde(rename = "outcomeCode")]
        outcome_code: String,
        #[serde(rename = "cleanupResult")]
        cleanup_result: String,
        #[serde(rename = "progressEvents")]
        progress_events: u64,
        #[serde(rename = "lateProgressEvents")]
        late_progress_events: u64,
    }

    #[derive(Serialize)]
    struct NativeSmokeFailureMarker {
        #[serde(rename = "protocolVersion")]
        protocol_version: u8,
        #[serde(rename = "requestId")]
        request_id: String,
        status: &'static str,
        phase: String,
        message: String,
    }

    fn write_native_smoke_marker(bytes: Vec<u8>) -> Result<(), NativeSimulationError> {
        let path = std::env::temp_dir().join(NATIVE_SMOKE_MARKER_FILE);
        std::fs::write(&path, bytes).map_err(|error| {
            NativeSimulationError::new(
                "execution",
                format!(
                    "Falha ao gravar o marcador do smoke nativo em {}: {error}",
                    path.display()
                ),
            )
        })
    }

    pub(crate) fn native_smoke_mode_from_args<I, S>(args: I) -> &'static str
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let arguments: Vec<String> = args
            .into_iter()
            .map(|argument| argument.as_ref().to_owned())
            .collect();
        if arguments
            .iter()
            .any(|argument| argument == "--native-smoke-error")
        {
            "error"
        } else if arguments
            .iter()
            .any(|argument| argument == "--native-smoke-cancel")
        {
            "cancel"
        } else if arguments
            .iter()
            .any(|argument| argument == "--native-smoke")
        {
            "success"
        } else {
            "disabled"
        }
    }

    #[tauri::command]
    pub fn native_smoke_mode() -> &'static str {
        native_smoke_mode_from_args(std::env::args())
    }

    #[tauri::command]
    pub fn is_native_smoke_enabled() -> bool {
        native_smoke_mode() != "disabled"
    }

    #[tauri::command]
    pub fn finish_native_smoke(
        request_id: String,
        progress_events: u64,
        snapshot_count: u64,
    ) -> Result<(), NativeSimulationError> {
        if request_id != NATIVE_SMOKE_REQUEST_ID {
            return Err(NativeSimulationError::new(
                "invalid-request",
                "requestId inválido para o smoke nativo.",
            ));
        }
        if progress_events == 0 || snapshot_count != 3 {
            return Err(NativeSimulationError::new(
                "invalid-request",
                "O smoke nativo exige pelo menos um progresso e exatamente três snapshots.",
            ));
        }

        let marker = NativeSmokeMarker {
            protocol_version: crate::simulation::NATIVE_PROTOCOL_VERSION,
            request_id,
            progress_events,
            snapshot_count,
        };
        let bytes = serde_json::to_vec_pretty(&marker).map_err(|error| {
            NativeSimulationError::new(
                "execution",
                format!("Falha ao serializar o marcador do smoke nativo: {error}"),
            )
        })?;
        write_native_smoke_marker(bytes)?;
        Ok(())
    }

    #[tauri::command]
    pub fn finish_native_cancel_smoke(
        request_id: String,
        cancel_result: String,
        outcome_code: String,
        progress_events: u64,
        late_progress_events: u64,
    ) -> Result<(), NativeSimulationError> {
        if request_id != NATIVE_SMOKE_REQUEST_ID {
            return Err(NativeSimulationError::new(
                "invalid-request",
                "requestId inválido para o smoke nativo.",
            ));
        }
        if cancel_result != "ok"
            || outcome_code != "cancelled"
            || progress_events > crate::simulation::MAX_NATIVE_PROGRESS_MESSAGES
            || late_progress_events != 0
        {
            return Err(NativeSimulationError::new(
                "invalid-request",
                format!(
                    "O smoke de cancelamento não comprovou cancelamento cooperativo: cancelResult={cancel_result}, outcomeCode={outcome_code}, progressEvents={progress_events}, lateProgressEvents={late_progress_events}.",
                ),
            ));
        }
        let marker = NativeSmokeCancelMarker {
            protocol_version: crate::simulation::NATIVE_PROTOCOL_VERSION,
            request_id,
            status: "success",
            cancel_result,
            outcome_code,
            progress_events,
            late_progress_events,
        };
        let bytes = serde_json::to_vec_pretty(&marker).map_err(|error| {
            NativeSimulationError::new(
                "execution",
                format!("Falha ao serializar o marcador de cancelamento: {error}"),
            )
        })?;
        write_native_smoke_marker(bytes)
    }

    pub(crate) fn validate_native_smoke_error(
        outcome_code: &str,
        cleanup_result: &str,
        progress_events: u64,
        late_progress_events: u64,
    ) -> Result<(), NativeSimulationError> {
        if outcome_code != "invalid-request"
            || cleanup_result != "invalid-request"
            || progress_events != 0
            || late_progress_events != 0
        {
            return Err(NativeSimulationError::new(
                "invalid-request",
                format!(
                    "O smoke de erro não comprovou rejeição fail-closed e teardown: outcomeCode={outcome_code}, cleanupResult={cleanup_result}, progressEvents={progress_events}, lateProgressEvents={late_progress_events}.",
                ),
            ));
        }
        Ok(())
    }

    #[tauri::command]
    pub fn finish_native_error_smoke(
        request_id: String,
        outcome_code: String,
        cleanup_result: String,
        progress_events: u64,
        late_progress_events: u64,
    ) -> Result<(), NativeSimulationError> {
        if request_id != NATIVE_SMOKE_REQUEST_ID {
            return Err(NativeSimulationError::new(
                "invalid-request",
                "requestId inválido para o smoke nativo.",
            ));
        }
        validate_native_smoke_error(
            &outcome_code,
            &cleanup_result,
            progress_events,
            late_progress_events,
        )?;
        let marker = NativeSmokeErrorMarker {
            protocol_version: crate::simulation::NATIVE_PROTOCOL_VERSION,
            request_id,
            status: "success",
            outcome_code,
            cleanup_result,
            progress_events,
            late_progress_events,
        };
        let bytes = serde_json::to_vec_pretty(&marker).map_err(|error| {
            NativeSimulationError::new(
                "execution",
                format!("Falha ao serializar o marcador de erro: {error}"),
            )
        })?;
        write_native_smoke_marker(bytes)
    }

    #[tauri::command]
    pub fn record_native_smoke_failure(
        request_id: String,
        phase: String,
        message: String,
    ) -> Result<(), NativeSimulationError> {
        if request_id != NATIVE_SMOKE_REQUEST_ID {
            return Err(NativeSimulationError::new(
                "invalid-request",
                "requestId inválido para o smoke nativo.",
            ));
        }
        if phase.is_empty() || phase.len() > 64 || message.is_empty() || message.len() > 2_000 {
            return Err(NativeSimulationError::new(
                "invalid-request",
                "diagnóstico de smoke inválido.",
            ));
        }
        let marker = NativeSmokeFailureMarker {
            protocol_version: crate::simulation::NATIVE_PROTOCOL_VERSION,
            request_id,
            status: "failed",
            phase,
            message,
        };
        let bytes = serde_json::to_vec_pretty(&marker).map_err(|error| {
            NativeSimulationError::new(
                "execution",
                format!("Falha ao serializar falha do smoke nativo: {error}"),
            )
        })?;
        write_native_smoke_marker(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::{Arc, AtomicBool, NativeCancellationRegistry, NativeRegistryError};
    use crate::commands::{native_smoke_mode_from_args, validate_native_smoke_error};
    use crate::simulation::{
        NativeSimulationError, NativeSimulationRequest, NativeSimulationResult,
        NATIVE_SIMULATION_PROGRESS_EVENT,
    };
    use serde_json::{json, Value};
    use std::sync::atomic::Ordering;
    use std::sync::mpsc::sync_channel;
    use std::time::Duration;
    use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets};
    use tauri::webview::InvokeRequest;
    use tauri::{ipc::InvokeBody, Listener, Manager, State, WebviewWindowBuilder};

    fn mock_native_window() -> (
        tauri::App<tauri::test::MockRuntime>,
        tauri::WebviewWindow<tauri::test::MockRuntime>,
    ) {
        let app = mock_builder()
            .manage(NativeCancellationRegistry::default())
            .invoke_handler(tauri::generate_handler![
                crate::tests::simulate_circuit_native,
                crate::commands::cancel_circuit_native
            ])
            .build(mock_context(noop_assets()))
            .expect("mock Tauri app should build");
        let window = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("mock Tauri window should build");
        (app, window)
    }

    fn invoke_request(command: &str, body: Value) -> InvokeRequest {
        InvokeRequest {
            cmd: command.to_owned(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "tauri://localhost".parse().expect("mock URL should parse"),
            body: InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.to_owned(),
        }
    }

    #[tauri::command]
    async fn simulate_circuit_native(
        request: NativeSimulationRequest,
        registry: State<'_, NativeCancellationRegistry>,
        app: tauri::AppHandle<tauri::test::MockRuntime>,
    ) -> Result<NativeSimulationResult, NativeSimulationError> {
        crate::commands::simulate_circuit_native_for_runtime(request, registry, app).await
    }

    fn scalar_dff_invoke_body(request_id: &str) -> Value {
        json!({
            "request": {
                "protocolVersion": 1,
                "requestId": request_id,
                "components": [
                    { "id": "d", "type": "input" },
                    { "id": "clk", "type": "clock", "options": { "period": 1 } },
                    { "id": "ff", "type": "dff", "inputs": [
                        { "node": "d" },
                        { "node": "clk" }
                    ] },
                ],
                "steps": [
                    { "set": { "d": true }, "ticks": 1 },
                    { "ticks": 1 }
                ],
                "watch": ["d", "clk", "ff"],
                "yieldEvery": 1,
                "timeoutMs": 30000
            }
        })
    }

    #[test]
    fn native_smoke_mode_requires_an_explicit_argument() {
        assert_eq!(native_smoke_mode_from_args(Vec::<&str>::new()), "disabled");
        assert_eq!(
            native_smoke_mode_from_args(["veritas", "--native-smoke"]),
            "success"
        );
        assert_eq!(
            native_smoke_mode_from_args(["veritas", "--native-smoke-cancel"]),
            "cancel"
        );
        assert_eq!(
            native_smoke_mode_from_args(["veritas", "--native-smoke-error"]),
            "error"
        );
    }

    #[test]
    fn native_smoke_error_validation_is_fail_closed() {
        assert!(validate_native_smoke_error("invalid-request", "invalid-request", 0, 0).is_ok());
        assert!(validate_native_smoke_error("completed", "invalid-request", 0, 0).is_err());
        assert!(validate_native_smoke_error("invalid-request", "ok", 0, 0).is_err());
        assert!(validate_native_smoke_error("invalid-request", "invalid-request", 1, 0).is_err());
        assert!(validate_native_smoke_error("invalid-request", "invalid-request", 0, 1).is_err());
    }

    #[test]
    fn invoke_executes_native_command_and_emits_bounded_progress() {
        let (app, window) = mock_native_window();
        let (progress_tx, progress_rx) = sync_channel(4);
        let listener_id = app.listen(NATIVE_SIMULATION_PROGRESS_EVENT, move |event| {
            let _ = progress_tx.send(event.payload().to_owned());
        });

        let response = get_ipc_response(
            &window,
            invoke_request(
                "simulate_circuit_native",
                scalar_dff_invoke_body("ipc-success"),
            ),
        )
        .expect("invoke should return a successful response")
        .deserialize::<Value>()
        .expect("response should be valid JSON");

        app.unlisten(listener_id);
        assert_eq!(
            app.state::<NativeCancellationRegistry>()
                .cancel("ipc-success"),
            Err(NativeRegistryError::Missing)
        );
        assert_eq!(response["protocolVersion"], 1);
        assert_eq!(response["requestId"], "ipc-success");
        assert_eq!(response["snapshots"].as_array().map(Vec::len), Some(3));
        let progress_payload = progress_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("invoke should emit at least one bounded progress event");
        let progress: Value =
            serde_json::from_str(&progress_payload).expect("progress should be JSON");
        assert_eq!(progress["protocolVersion"], 1);
        assert_eq!(progress["requestId"], "ipc-success");
    }

    #[test]
    fn invoke_rejects_unknown_native_request_fields_fail_closed() {
        let (_app, window) = mock_native_window();
        let mut body = scalar_dff_invoke_body("ipc-invalid");
        body["request"]["unknown"] = json!(true);

        let error = get_ipc_response(&window, invoke_request("simulate_circuit_native", body))
            .expect_err("invoke should reject unknown fields");

        let message = error.as_str().unwrap_or_default();
        assert!(!message.is_empty());
        assert!(message.contains("unknown") || message.contains("desconhecido"));
    }

    #[test]
    fn registry_rejects_duplicate_request_ids_and_cleans_on_drop() {
        let registry = NativeCancellationRegistry::default();
        let first_cancel = Arc::new(AtomicBool::new(false));
        let first_cleanup = registry
            .register("duplicate", first_cancel)
            .expect("first registration should succeed");
        let duplicate = registry.register("duplicate", Arc::new(AtomicBool::new(false)));
        assert!(matches!(duplicate, Err(NativeRegistryError::Duplicate)));

        drop(first_cleanup);

        let second_cleanup = registry
            .register("duplicate", Arc::new(AtomicBool::new(false)))
            .expect("request id should be reusable after cleanup");
        drop(second_cleanup);
        assert_eq!(
            registry.cancel("duplicate"),
            Err(NativeRegistryError::Missing)
        );
    }

    #[test]
    fn registry_cancel_is_idempotent_while_request_is_active() {
        let registry = NativeCancellationRegistry::default();
        let cancel = Arc::new(AtomicBool::new(false));
        let cleanup = registry
            .register("cancel-me", cancel.clone())
            .expect("registration should succeed");

        assert_eq!(registry.cancel("cancel-me"), Ok(()));
        assert_eq!(registry.cancel("cancel-me"), Ok(()));
        assert!(cancel.load(Ordering::Relaxed));

        drop(cleanup);
        assert_eq!(
            registry.cancel("cancel-me"),
            Err(NativeRegistryError::Missing)
        );
    }

    #[test]
    fn registry_cleanup_is_attempted_when_scope_returns_early() {
        let registry = NativeCancellationRegistry::default();
        let cancel = Arc::new(AtomicBool::new(false));
        let result = (|| -> Result<(), NativeRegistryError> {
            let _cleanup = registry.register("early-return", cancel)?;
            Err(NativeRegistryError::Unavailable)
        })();

        assert_eq!(result, Err(NativeRegistryError::Unavailable));
        assert_eq!(
            registry.cancel("early-return"),
            Err(NativeRegistryError::Missing)
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let native_smoke_enabled = commands::native_smoke_mode() != "disabled";
    tauri::Builder::default()
        .manage(NativeCancellationRegistry::default())
        .setup(move |app| {
            if native_smoke_enabled {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(2));
                    for attempt in 0..100 {
                        if let Some(window) = handle.get_webview_window("main") {
                            eprintln!("native smoke window ready on attempt {attempt}");
                            match window.eval("window.location.hash = '#native-smoke'") {
                                Ok(()) => eprintln!("native smoke hash dispatched"),
                                Err(error) => eprintln!("native smoke eval failed: {error}"),
                            }
                            return;
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    eprintln!("native smoke window was not available after retry budget");
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::simulate_circuit_native,
            commands::cancel_circuit_native,
            commands::native_smoke_mode,
            commands::is_native_smoke_enabled,
            commands::finish_native_smoke,
            commands::finish_native_cancel_smoke,
            commands::finish_native_error_smoke,
            commands::record_native_smoke_failure
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Veritas");
}
