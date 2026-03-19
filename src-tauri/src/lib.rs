use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OllamaConfig {
    base_url: String,
    model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConfigJson {
    provider: String,
    ollama: OllamaConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppState {
    config_json_path: String,
    env_path: String,
    default_mcp_path: String,
    config: ConfigJson,
    env: BTreeMap<String, String>,
    hooks_dir: String,
    pre_hook: String,
    post_hook: String,
    global_rules_path: String,
}

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Unable to resolve HOME directory".to_string())
}

fn cline_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".config").join("cline"))
}

fn config_json_path() -> Result<PathBuf, String> {
    Ok(cline_dir()?.join("config.json"))
}

fn env_path() -> Result<PathBuf, String> {
    Ok(cline_dir()?.join("cline.env"))
}

fn hooks_dir_path() -> Result<PathBuf, String> {
    Ok(cline_dir()?.join("hooks"))
}

fn pre_hook_path() -> Result<PathBuf, String> {
    Ok(hooks_dir_path()?.join("pre_run.sh"))
}

fn post_hook_path() -> Result<PathBuf, String> {
    Ok(hooks_dir_path()?.join("post_run.sh"))
}

fn default_mcp_path() -> Result<PathBuf, String> {
    Ok(cline_dir()?.join("mcp.json"))
}

fn global_rules_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join("Documents").join("Cline").join("Rules"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupResult {
    success: bool,
    backup_path: Option<String>,
    error: Option<String>,
}

#[tauri::command]
fn backup_config() -> BackupResult {
    let config_path = match config_json_path() {
        Ok(p) => p,
        Err(e) => return BackupResult { success: false, backup_path: None, error: Some(e) },
    };

    if !config_path.exists() {
        return BackupResult {
            success: false,
            backup_path: None,
            error: Some(format!("Config file not found: {}", config_path.display())),
        };
    }

    let config_content = match fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(e) => return BackupResult { success: false, backup_path: None, error: Some(format!("Failed to read config: {}", e)) },
    };

    if let Err(e) = serde_json::from_str::<Value>(&config_content) {
        return BackupResult { success: false, backup_path: None, error: Some(format!("Invalid JSON in config: {}", e)) };
    }

    let backups = match backups_dir() {
        Ok(b) => b,
        Err(e) => return BackupResult { success: false, backup_path: None, error: Some(e) },
    };

    if let Err(e) = fs::create_dir_all(&backups) {
        return BackupResult { success: false, backup_path: None, error: Some(format!("Failed to create backups dir: {}", e)) };
    }

    let timestamp = chrono_lite_timestamp();
    let backup_filename = format!("config-{}.json", timestamp);
    let backup_path = backups.join(&backup_filename);

    if let Err(e) = fs::write(&backup_path, &config_content) {
        return BackupResult { success: false, backup_path: None, error: Some(format!("Failed to write backup: {}", e)) };
    }

    BackupResult {
        success: true,
        backup_path: Some(backup_path.to_string_lossy().to_string()),
        error: None,
    }
}

fn chrono_lite_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    let days = secs / 86400;
    let remaining = secs % 86400;
    let hours = remaining / 3600;
    let mins = (remaining % 3600) / 60;
    let seconds = remaining % 60;
    let base_year = 1970;
    let mut year = base_year;
    let mut days_left = days as i64;
    while days_in_year(year) <= days_left {
        days_left -= days_in_year(year);
        year += 1;
    }
    let month_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1;
    for m in month_days.iter() {
        if days_left < *m as i64 {
            break;
        }
        days_left -= *m as i64;
        month += 1;
    }
    let day = days_left + 1;
    format!("{:04}-{:02}-{:02}-{:02}{:02}{:02}", year, month, day, hours, mins, seconds)
}

fn days_in_year(year: i64) -> i64 {
    if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
        366
    } else {
        365
    }
}

fn backups_dir() -> Result<PathBuf, String> {
    Ok(cline_dir()?.join("backups"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile {
    filename: String,
    path: String,
    created_at: String,
}

#[tauri::command]
fn list_backups() -> Result<Vec<BackupFile>, String> {
    let backups = backups_dir()?;

    if !backups.exists() {
        return Ok(Vec::new());
    }

    let mut backup_files: Vec<BackupFile> = Vec::new();

    for entry in fs::read_dir(&backups).map_err(|e| format!("Failed to read backups dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().map(|e| e == "json").unwrap_or(false) {
            let filename = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Extract timestamp from filename format: config-YYYY-MM-DD-HHMMSS.json
            let created_at = filename
                .strip_prefix("config-")
                .and_then(|s| s.strip_suffix(".json"))
                .map(|s| {
                    // Keep exact timestamp format from filename for predictable UI display
                    // Example: "2026-03-11-134500" -> "2026-03-11 13:45:00"
                    if s.len() == 17 {
                        format!("{} {}:{}:{}", &s[0..10], &s[11..13], &s[13..15], &s[15..17])
                    } else {
                        s.to_string()
                    }
                })
                .unwrap_or_else(|| "Unknown".to_string());

            backup_files.push(BackupFile {
                filename,
                path: path.to_string_lossy().to_string(),
                created_at,
            });
        }
    }

    // Sort by filename descending (newest first)
    backup_files.sort_by(|a, b| b.filename.cmp(&a.filename));

    Ok(backup_files)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RestoreResult {
    success: bool,
    restored_from: Option<String>,
    auto_backup_path: Option<String>,
    error: Option<String>,
}

#[tauri::command]
fn restore_config(backup_filename: String) -> RestoreResult {
    if backup_filename.contains('/') || backup_filename.contains('\\') || backup_filename.contains("..") {
        return RestoreResult {
            success: false,
            restored_from: None,
            auto_backup_path: None,
            error: Some("Invalid backup filename".to_string()),
        };
    }

    let backups = match backups_dir() {
        Ok(b) => b,
        Err(e) => return RestoreResult { success: false, restored_from: None, auto_backup_path: None, error: Some(e) },
    };

    let backup_path = backups.join(&backup_filename);

    if !backup_path.exists() {
        return RestoreResult {
            success: false,
            restored_from: None,
            auto_backup_path: None,
            error: Some(format!("Backup file not found: {}", backup_filename)),
        };
    }

    // Read and validate backup JSON before restoring
    let backup_content = match fs::read_to_string(&backup_path) {
        Ok(c) => c,
        Err(e) => return RestoreResult { success: false, restored_from: None, auto_backup_path: None, error: Some(format!("Failed to read backup: {}", e)) },
    };

    if let Err(e) = serde_json::from_str::<Value>(&backup_content) {
        return RestoreResult {
            success: false,
            restored_from: None,
            auto_backup_path: None,
            error: Some(format!("Invalid JSON in backup: {}", e)),
        };
    }

    // Create automatic backup of current config before overwriting
    let config_path = match config_json_path() {
        Ok(p) => p,
        Err(e) => return RestoreResult { success: false, restored_from: None, auto_backup_path: None, error: Some(e) },
    };

    let auto_backup_path = if config_path.exists() {
        let current_content = match fs::read_to_string(&config_path) {
            Ok(c) => c,
            Err(e) => {
                return RestoreResult {
                    success: false,
                    restored_from: None,
                    auto_backup_path: None,
                    error: Some(format!("Failed to read current config for backup: {}", e)),
                };
            }
        };

        // Validate current config is valid JSON too
        if let Err(e) = serde_json::from_str::<Value>(&current_content) {
            return RestoreResult {
                success: false,
                restored_from: None,
                auto_backup_path: None,
                error: Some(format!("Current config is invalid JSON: {}", e)),
            };
        }

        let timestamp = chrono_lite_timestamp();
        let auto_backup_filename = format!("pre-restore-{}.json", timestamp);
        let auto_path = backups.join(&auto_backup_filename);

        if let Err(e) = fs::write(&auto_path, &current_content) {
            return RestoreResult {
                success: false,
                restored_from: None,
                auto_backup_path: None,
                error: Some(format!("Failed to create pre-restore backup: {}", e)),
            };
        }

        Some(auto_path.to_string_lossy().to_string())
    } else {
        None
    };

    // Write the restored config
    if let Err(e) = fs::write(&config_path, &backup_content) {
        return RestoreResult {
            success: false,
            restored_from: None,
            auto_backup_path,
            error: Some(format!("Failed to write restored config: {}", e)),
        };
    }

    RestoreResult {
        success: true,
        restored_from: Some(backup_path.to_string_lossy().to_string()),
        auto_backup_path,
        error: None,
    }
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed creating {:?}: {}", parent, e))?;
    }
    Ok(())
}

fn read_or_default(path: &Path, default: &str) -> Result<String, String> {
    if !path.exists() {
        ensure_parent(path)?;
        fs::write(path, default).map_err(|e| format!("Failed writing default {:?}: {}", path, e))?;
        return Ok(default.to_string());
    }
    fs::read_to_string(path).map_err(|e| format!("Failed reading {:?}: {}", path, e))
}

fn parse_env(content: &str) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            out.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    out
}

fn env_to_string(env: &BTreeMap<String, String>) -> String {
    let mut lines = Vec::new();
    for (k, v) in env {
        lines.push(format!("{}={}", k, v));
    }
    lines.join("\n") + "\n"
}

fn normalize_base(base_url: &str) -> String {
    base_url.trim_end_matches('/').to_string()
}

#[tauri::command]
fn load_app_state() -> Result<AppState, String> {
    let config_path = config_json_path()?;
    let env_path = env_path()?;
    let hooks_dir = hooks_dir_path()?;
    let pre_hook = pre_hook_path()?;
    let post_hook = post_hook_path()?;
    let mcp_path = default_mcp_path()?;
    let global_rules = global_rules_path()?;

    let config_default = json!({
        "provider": "ollama",
        "ollama": {
            "baseUrl": "http://localhost:11434",
            "model": "qwen2.5-coder:14b"
        }
    })
    .to_string();

    let env_default = [
        "CLINE_MODEL_PROVIDER=ollama",
        "CLINE_OLLAMA_BASE_URL=http://localhost:11434",
        "CLINE_MODEL=qwen2.5-coder:14b",
        "CLINE_TEMPERATURE=0.25",
        "CLINE_MAX_CONTEXT_TOKENS=8192",
    ]
    .join("\n");

    let config_raw = read_or_default(&config_path, &config_default)?;
    let env_raw = read_or_default(&env_path, &env_default)?;
    fs::create_dir_all(&hooks_dir).map_err(|e| format!("Failed creating hooks dir: {}", e))?;
    let pre_hook_content = read_or_default(&pre_hook, "#!/usr/bin/env bash\n# pre-run hook\n")?;
    let post_hook_content = read_or_default(&post_hook, "#!/usr/bin/env bash\n# post-run hook\n")?;
    let _ = read_or_default(&mcp_path, "{\n  \"mcpServers\": {}\n}\n")?;

    let config: ConfigJson =
        serde_json::from_str(&config_raw).map_err(|e| format!("Invalid config.json: {}", e))?;
    let env_map = parse_env(&env_raw);

    Ok(AppState {
        config_json_path: config_path.to_string_lossy().to_string(),
        env_path: env_path.to_string_lossy().to_string(),
        default_mcp_path: mcp_path.to_string_lossy().to_string(),
        config,
        env: env_map,
        hooks_dir: hooks_dir.to_string_lossy().to_string(),
        pre_hook: pre_hook_content,
        post_hook: post_hook_content,
        global_rules_path: global_rules.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn save_core_config(config: ConfigJson, env: BTreeMap<String, String>) -> Result<(), String> {
    let config_path = config_json_path()?;
    let env_path = env_path()?;

    ensure_parent(&config_path)?;
    ensure_parent(&env_path)?;

    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed serializing config: {}", e))?;
    fs::write(&config_path, config_json).map_err(|e| format!("Write config.json failed: {}", e))?;
    fs::write(&env_path, env_to_string(&env)).map_err(|e| format!("Write cline.env failed: {}", e))?;

    Ok(())
}

#[tauri::command]
fn save_hooks(pre_hook: String, post_hook: String) -> Result<(), String> {
    let pre_path = pre_hook_path()?;
    let post_path = post_hook_path()?;
    ensure_parent(&pre_path)?;
    ensure_parent(&post_path)?;
    fs::write(pre_path, pre_hook).map_err(|e| format!("Failed writing pre hook: {}", e))?;
    fs::write(post_path, post_hook).map_err(|e| format!("Failed writing post hook: {}", e))?;
    Ok(())
}

#[tauri::command]
fn list_rule_files(repo_root: String, global_rules_path: String) -> Result<Vec<String>, String> {
    let mut files: Vec<String> = Vec::new();

    let repo_cline = PathBuf::from(repo_root).join(".cline");
    if repo_cline.exists() {
        for entry in WalkDir::new(repo_cline).into_iter().filter_map(Result::ok) {
            let p = entry.path();
            if p.is_file() && p.extension().map(|e| e == "md").unwrap_or(false) {
                files.push(p.to_string_lossy().to_string());
            }
        }
    }

    let global = PathBuf::from(global_rules_path);
    if global.exists() {
        for entry in WalkDir::new(global).into_iter().filter_map(Result::ok) {
            let p = entry.path();
            if p.is_file() && p.extension().map(|e| e == "md").unwrap_or(false) {
                files.push(p.to_string_lossy().to_string());
            }
        }
    }

    files.sort();
    Ok(files)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Read failed: {}", e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    ensure_parent(&path_buf)?;
    fs::write(path_buf, content).map_err(|e| format!("Write failed: {}", e))
}

#[tauri::command]
async fn list_ollama_models(base_url: String) -> Result<Vec<String>, String> {
    let url = format!("{}/api/tags", normalize_base(&base_url));
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let value: Value = response
        .json()
        .await
        .map_err(|e| format!("Ollama JSON parse failed: {}", e))?;

    let mut models = Vec::new();
    if let Some(arr) = value.get("models").and_then(|m| m.as_array()) {
        for item in arr {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                models.push(name.to_string());
            }
        }
    }
    Ok(models)
}

#[tauri::command]
async fn generate_recommendations(
    base_url: String,
    model: String,
    context_json: String,
) -> Result<String, String> {
    let prompt = format!(
        "You are a Cline CLI configuration advisor. Return concise recommendations in markdown.\n\nContext:\n{}\n\nOutput sections: Recommended Defaults, Model Advice, Rules Advice, MCP Advice.",
        context_json
    );
    let url = format!("{}/api/generate", normalize_base(&base_url));
    let payload = json!({
        "model": model,
        "prompt": prompt,
        "stream": false
    });

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let value: Value = response
        .json()
        .await
        .map_err(|e| format!("Ollama JSON parse failed: {}", e))?;

    if let Some(text) = value.get("response").and_then(|r| r.as_str()) {
        return Ok(text.to_string());
    }

    Ok("No recommendation text returned by model.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_home() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("cline-configurator-test-{}", nanos))
    }

    #[test]
    fn backup_config_missing_file_returns_error() {
        let home = unique_test_home();
        std::fs::create_dir_all(&home).expect("create temp home");
        std::env::set_var("HOME", &home);

        let result = backup_config();

        assert!(!result.success);
        assert!(result.backup_path.is_none());
        assert!(result.error.unwrap_or_default().contains("Config file not found"));
    }

    #[test]
    fn backup_config_creates_timestamped_valid_json_backup() {
        let home = unique_test_home();
        let cline = home.join(".config").join("cline");
        std::fs::create_dir_all(&cline).expect("create cline dir");
        std::env::set_var("HOME", &home);

        let config = r#"{"provider":"ollama","ollama":{"baseUrl":"http://localhost:11434","model":"qwen2.5-coder:14b"}}"#;
        std::fs::write(cline.join("config.json"), config).expect("write config");

        let result = backup_config();

        assert!(result.success);
        let backup_path = PathBuf::from(result.backup_path.expect("backup path"));
        assert!(backup_path.exists());

        let backup_name = backup_path.file_name().and_then(|n| n.to_str()).unwrap_or_default();
        assert!(backup_name.starts_with("config-"));
        assert!(backup_name.ends_with(".json"));

        let backup_content = std::fs::read_to_string(&backup_path).expect("read backup");
        let parsed: Value = serde_json::from_str(&backup_content).expect("valid json");
        assert_eq!(parsed["provider"], "ollama");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_core_config,
            save_hooks,
            list_rule_files,
            read_text_file,
            write_text_file,
            list_ollama_models,
            generate_recommendations,
            backup_config,
            list_backups,
            restore_config,
        ])
        .setup(|app| {
            let _ = app.handle();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
