// Types for Cline Configurator

export type ConfigJson = {
  provider: string;
  ollama: {
    baseUrl: string;
    model: string;
  };
};

export type AppState = {
  configJsonPath: string;
  envPath: string;
  defaultMcpPath: string;
  config: ConfigJson;
  env: Record<string, string>;
  hooksDir: string;
  preHook: string;
  postHook: string;
  globalRulesPath: string;
};

export type BackupResult = {
  success: boolean;
  backupPath?: string | null;
  error?: string | null;
};

export type BackupFile = {
  filename: string;
  path: string;
  createdAt: string;
};

export type RestoreResult = {
  success: boolean;
  restoredFrom?: string | null;
  autoBackupPath?: string | null;
  error?: string | null;
};