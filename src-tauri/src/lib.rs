pub mod simulation;

use std::collections::HashMap;
use std::sync::{atomic::AtomicBool, Arc, Mutex};

#[derive(Default)]
pub struct NativeCancellationRegistry {
    requests: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

pub mod commands {
    use super::{Arc, AtomicBool, NativeCancellationRegistry};
    use crate::simulation::{
        execute_native_with_progress, NativeSimulationError, NativeSimulationRequest,
        NativeSimulationResult, NATIVE_SIMULATION_PROGRESS_EVENT,
    };
    use std::sync::atomic::Ordering;
    use tauri::{Emitter, State};

    #[tauri::command]
    pub async fn simulate_circuit_native(
        request: NativeSimulationRequest,
        registry: State<'_, NativeCancellationRegistry>,
        app: tauri::AppHandle,
    ) -> Result<NativeSimulationResult, NativeSimulationError> {
        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut requests = registry.requests.lock().map_err(|_| {
                NativeSimulationError::new(
                    "execution",
                    "O registro de cancelamento está indisponível.",
                )
            })?;
            if requests.contains_key(&request.request_id) {
                return Err(NativeSimulationError::new(
                    "invalid-request",
                    "Já existe uma execução nativa com esse requestId.",
                ));
            }
            requests.insert(request.request_id.clone(), cancel.clone());
        }

        let request_id = request.request_id.clone();
        let app = app.clone();
        let result = tauri::async_runtime::spawn_blocking(move || {
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
        })?;
        if let Ok(mut requests) = registry.requests.lock() {
            requests.remove(&request_id);
        }
        result
    }

    #[tauri::command]
    pub fn cancel_circuit_native(
        request_id: String,
        registry: State<'_, NativeCancellationRegistry>,
    ) -> Result<(), NativeSimulationError> {
        let requests = registry.requests.lock().map_err(|_| {
            NativeSimulationError::new("execution", "O registro de cancelamento está indisponível.")
        })?;
        let cancel = requests.get(&request_id).ok_or_else(|| {
            NativeSimulationError::new(
                "invalid-request",
                "Não existe execução nativa ativa para esse requestId.",
            )
        })?;
        cancel.store(true, Ordering::Relaxed);
        Ok(())
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
        .expect("erro ao executar o aplicativo Veritas")
}
