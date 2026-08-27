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

    #[tauri::command]
    pub async fn simulate_circuit_native(
        request: NativeSimulationRequest,
        registry: State<'_, NativeCancellationRegistry>,
        app: tauri::AppHandle,
    ) -> Result<NativeSimulationResult, NativeSimulationError> {
        let cancel = Arc::new(AtomicBool::new(false));
        let _cleanup = registry
            .register(&request.request_id, cancel.clone())
            .map_err(map_registry_error)?;

        let app = app.clone();
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
    pub fn cancel_circuit_native(
        request_id: String,
        registry: State<'_, NativeCancellationRegistry>,
    ) -> Result<(), NativeSimulationError> {
        registry.cancel(&request_id).map_err(map_registry_error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::Ordering;

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
