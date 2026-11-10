use atomicwrites::{AllowOverwrite, AtomicFile};
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

const HISTORY_LIMIT: usize = 200;

#[derive(Serialize)]
pub struct FinishResult {
    profile: Value,
    history: Value,
}

pub struct Storage {
    root: PathBuf,
    lock: Mutex<()>,
}

impl Storage {
    pub fn new(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(root.join("backups"))
            .map_err(|error| format!("cannot create backup directory: {error}"))?;
        fs::create_dir_all(root.join("corrupt"))
            .map_err(|error| format!("cannot create recovery directory: {error}"))?;
        Ok(Self {
            root,
            lock: Mutex::new(()),
        })
    }

    fn guard(&self) -> Result<MutexGuard<'_, ()>, String> {
        self.lock
            .lock()
            .map_err(|_| "storage lock poisoned".to_string())
    }

    fn path(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }

    fn backup_path(&self, name: &str) -> PathBuf {
        self.root.join("backups").join(format!("{name}.bak"))
    }

    fn read_json(&self, name: &str) -> Result<Option<Value>, String> {
        let path = self.path(name);
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(format!("cannot read {name}: {error}")),
        };

        match serde_json::from_slice::<Value>(&bytes) {
            Ok(value) => Ok(Some(value)),
            Err(primary_error) => {
                let backup = self.backup_path(name);
                if let Ok(backup_bytes) = fs::read(&backup) {
                    if let Ok(value) = serde_json::from_slice::<Value>(&backup_bytes) {
                        self.quarantine(name);
                        let _ = self.write_json_without_backup(name, &value);
                        return Ok(Some(value));
                    }
                }
                self.quarantine(name);
                Err(format!("{name} is not valid JSON: {primary_error}"))
            }
        }
    }

    fn write_json_without_backup(&self, name: &str, value: &Value) -> Result<(), String> {
        let path = self.path(name);
        let data = serde_json::to_vec_pretty(value)
            .map_err(|error| format!("cannot serialize {name}: {error}"))?;
        AtomicFile::new(&path, AllowOverwrite)
            .write(|file| {
                file.write_all(&data)?;
                file.sync_all()
            })
            .map_err(|error| format!("cannot write {name}: {error}"))
    }

    fn write_json(&self, name: &str, value: &Value) -> Result<(), String> {
        let path = self.path(name);
        if path.exists() {
            let backup = self.backup_path(name);
            fs::copy(&path, &backup)
                .map_err(|error| format!("cannot back up {name}: {error}"))?;
        }
        self.write_json_without_backup(name, value)
    }

    fn quarantine(&self, name: &str) {
        let path = self.path(name);
        if !path.exists() {
            return;
        }
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let destination = self
            .root
            .join("corrupt")
            .join(format!("{stamp}-{name}"));
        let _ = fs::copy(&path, destination);
    }

    fn remove(&self, name: &str) -> Result<(), String> {
        let path = self.path(name);
        match fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("cannot remove {name}: {error}")),
        }
    }

    fn empty_history() -> Value {
        json!({ "schemaVersion": 1, "records": [] })
    }

    fn default_profile() -> Value {
        json!({
            "schemaVersion": 1,
            "settings": {},
            "stats": {
                "bestScore": 0,
                "bestTile": 0,
                "gamesPlayed": 0,
                "gamesWon": 0
            },
            "lastFinishedGameId": null
        })
    }

    fn load_profile_value(&self) -> Result<Value, String> {
        Ok(self
            .read_json("profile.json")?
            .unwrap_or_else(Self::default_profile))
    }

    fn load_history_value(&self) -> Result<Value, String> {
        Ok(self
            .read_json("history.json")?
            .unwrap_or_else(Self::empty_history))
    }

    pub fn load_profile(&self) -> Result<Option<Value>, String> {
        let _guard = self.guard()?;
        self.read_json("profile.json")
    }

    pub fn save_profile(&self, profile: Value) -> Result<(), String> {
        let _guard = self.guard()?;
        self.write_json("profile.json", &profile)
    }

    pub fn load_session(&self) -> Result<Option<Value>, String> {
        let _guard = self.guard()?;
        self.read_json("session.json")
    }

    pub fn save_session(&self, session: Value) -> Result<(), String> {
        let _guard = self.guard()?;
        self.write_json("session.json", &session)
    }

    pub fn clear_session(&self) -> Result<(), String> {
        let _guard = self.guard()?;
        self.remove("session.json")
    }

    pub fn load_history(&self) -> Result<Option<Value>, String> {
        let _guard = self.guard()?;
        self.read_json("history.json")
    }

    pub fn finish_game(&self, record: Value) -> Result<FinishResult, String> {
        let _guard = self.guard()?;

        let game_id = record
            .get("gameId")
            .and_then(Value::as_str)
            .ok_or_else(|| "finished record is missing gameId".to_string())?
            .to_string();
        let result = record
            .get("result")
            .and_then(Value::as_str)
            .unwrap_or("lost")
            .to_string();
        let score = record
            .get("score")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        let best_tile = record
            .get("bestTile")
            .and_then(Value::as_u64)
            .unwrap_or(0);

        let mut history = self.load_history_value()?;
        let records = history
            .get_mut("records")
            .and_then(Value::as_array_mut)
            .ok_or_else(|| "history file has no records array".to_string())?;
        records.retain(|item| item.get("gameId").and_then(Value::as_str) != Some(game_id.as_str()));
        records.push(record);
        records.sort_by(|a, b| {
            let a = a.get("endedAt").and_then(Value::as_str).unwrap_or("");
            let b = b.get("endedAt").and_then(Value::as_str).unwrap_or("");
            b.cmp(a)
        });
        records.truncate(HISTORY_LIMIT);

        let mut profile = self.load_profile_value()?;
        if !profile.get("stats").is_some_and(Value::is_object) {
            profile["stats"] = json!({
                "bestScore": 0,
                "bestTile": 0,
                "gamesPlayed": 0,
                "gamesWon": 0
            });
        }
        let last_id = profile
            .get("lastFinishedGameId")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let stats = profile
            .get_mut("stats")
            .and_then(Value::as_object_mut)
            .ok_or_else(|| "profile has no stats object".to_string())?;

        let current_best = stats.get("bestScore").and_then(Value::as_u64).unwrap_or(0);
        let current_tile = stats.get("bestTile").and_then(Value::as_u64).unwrap_or(0);
        stats.insert("bestScore".to_string(), json!(current_best.max(score)));
        stats.insert("bestTile".to_string(), json!(current_tile.max(best_tile)));

        if last_id != game_id {
            let games_played = stats
                .get("gamesPlayed")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let games_won = stats.get("gamesWon").and_then(Value::as_u64).unwrap_or(0);
            stats.insert("gamesPlayed".to_string(), json!(games_played + 1));
            if result == "won" {
                stats.insert("gamesWon".to_string(), json!(games_won + 1));
            }
            profile["lastFinishedGameId"] = Value::String(game_id.clone());
        }

        // History first, then statistics, then remove the active session. Each
        // step is idempotent, so a crash between steps can be retried safely.
        self.write_json("history.json", &history)?;
        self.write_json("profile.json", &profile)?;
        self.remove("session.json")?;

        Ok(FinishResult { profile, history })
    }

    pub fn clear_history(&self) -> Result<(), String> {
        let _guard = self.guard()?;
        self.write_json("history.json", &Self::empty_history())?;
        let _ = fs::remove_file(self.backup_path("history.json"));
        Ok(())
    }

    pub fn reset_all(&self) -> Result<(), String> {
        let _guard = self.guard()?;
        for name in ["profile.json", "session.json", "history.json"] {
            self.remove(name)?;
        }
        for directory in ["backups", "corrupt"] {
            let path = self.root.join(directory);
            if path.exists() {
                fs::remove_dir_all(&path)
                    .map_err(|error| format!("cannot clear {directory}: {error}"))?;
            }
            fs::create_dir_all(&path)
                .map_err(|error| format!("cannot recreate {directory}: {error}"))?;
        }
        Ok(())
    }
}

pub fn app_data_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(override_dir) = std::env::var("GAME2048_DATA_DIR") {
        if !override_dir.trim().is_empty() {
            return Ok(PathBuf::from(override_dir));
        }
    }
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .map_err(|error| format!("cannot resolve app data directory: {error}"))
}
