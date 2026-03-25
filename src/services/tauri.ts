// Service layer for Tauri API calls
import { invoke } from "@tauri-apps/api/core";
import type { AppState, BackupResult, BackupFile, RestoreResult } from "../types";

export const tauriService = {
  async loadAppState(): Promise<AppState> {
    return invoke<AppState>("load_app_state");
  },

  async saveCoreConfig(config: AppState["config"], env: Record<string, string>): Promise<void> {
    await invoke("save_core_config", { config, env });
  },

  async listRuleFiles(repoRoot: string, globalRulesPath: string): Promise<string[]> {
    return invoke<string[]>("list_rule_files", { repoRoot, globalRulesPath });
  },

  async readTextFile(path: string): Promise<string> {
    return invoke<string>("read_text_file", { path });
  },

  async writeTextFile(path: string, content: string): Promise<void> {
    await invoke("write_text_file", { path, content });
  },

  async saveHooks(preHook: string, postHook: string): Promise<void> {
    await invoke("save_hooks", { preHook, postHook });
  },

  async listOllamaModels(baseUrl: string): Promise<string[]> {
    return invoke<string[]>("list_ollama_models", { baseUrl });
  },

  async generateRecommendations(
    baseUrl: string,
    model: string,
    contextJson: string
  ): Promise<string> {
    return invoke<string>("generate_recommendations", {
      baseUrl,
      model,
      contextJson,
    });
  },

  async backupConfig(): Promise<BackupResult> {
    return invoke<BackupResult>("backup_config");
  },

  async listBackups(): Promise<BackupFile[]> {
    return invoke<BackupFile[]>("list_backups");
  },

  async restoreConfig(backupFilename: string): Promise<RestoreResult> {
    return invoke<RestoreResult>("restore_config", { backupFilename });
  },
};