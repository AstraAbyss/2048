mod storage;

use serde_json::Value;
use storage::{app_data_path, FinishResult, Storage};
use tauri::{Manager, State};

#[tauri::command]
fn load_profile(storage: State<'_, Storage>) -> Result<Option<Value>, String> {
    storage.load_profile()
}

#[tauri::command]
fn save_profile(profile: Value, storage: State<'_, Storage>) -> Result<(), String> {
    storage.save_profile(profile)
}

#[tauri::command]
fn load_session(storage: State<'_, Storage>) -> Result<Option<Value>, String> {
    storage.load_session()
}

#[tauri::command]
fn save_session(session: Value, storage: State<'_, Storage>) -> Result<(), String> {
    storage.save_session(session)
}

#[tauri::command]
fn clear_session(storage: State<'_, Storage>) -> Result<(), String> {
    storage.clear_session()
}

#[tauri::command]
fn load_history(storage: State<'_, Storage>) -> Result<Option<Value>, String> {
    storage.load_history()
}

#[tauri::command]
fn finish_game(record: Value, storage: State<'_, Storage>) -> Result<FinishResult, String> {
    storage.finish_game(record)
}

#[tauri::command]
fn clear_history(storage: State<'_, Storage>) -> Result<(), String> {
    storage.clear_history()
}

#[tauri::command]
fn reset_all(storage: State<'_, Storage>) -> Result<(), String> {
    storage.reset_all()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut context = tauri::generate_context!();
    if let Ok(data_dir) = std::env::var("GAME2048_DATA_DIR") {
        if !data_dir.trim().is_empty() {
            context.config_mut().app.app_directories_override =
                Some(tauri::utils::config::AppDirectoriesOverride::Root(data_dir.into()));
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let dir = app_data_path(app.handle())
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            let storage = Storage::new(dir)
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            app.manage(storage);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_profile,
            save_profile,
            load_session,
            save_session,
            clear_session,
            load_history,
            finish_game,
            clear_history,
            reset_all
        ])
        .run(context)
        .expect("error while running 2048");
}
