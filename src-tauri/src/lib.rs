pub mod simulation;

use std::collections::HashMap;
use std::sync::{atomic::AtomicBool, Arc, Mutex};

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
    use super::{Arc, AtomicBool, NativeCancellationRegistry, NativeRegistryError};
    use crate::simulation::{
        execute_native_with_progress, NativeSimulationError, NativeSimulationRequest,
        NativeSimulationResult, NATIVE_SIMULATION_PROGRESS_EVENT,
    };
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
        let _cleanup = registry
            .register(&request.request_id, cancel.clone())
            .map_err(map_registry_error)?;

        tauri::async_runtime::spawn_blocking(move || {
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
}

#[cfg(test)]
mod tests {
    use super::{Arc, AtomicBool, NativeCancellationRegistry, NativeRegistryError};
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
    tauri::Builder::default()
        .manage(NativeCancellationRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::simulate_circuit_native,
            commands::cancel_circuit_native
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Veritas");
}
