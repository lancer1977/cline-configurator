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
        ])
        .setup(|app| {
            let _ = app.handle();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
