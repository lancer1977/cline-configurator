import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type ConfigJson = {
  provider: string;
  ollama: {
    baseUrl: string;
    model: string;
  };
};

type AppState = {
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

type BackupResult = {
  success: boolean;
  backupPath?: string | null;
  error?: string | null;
};

type BackupFile = {
  filename: string;
  path: string;
  createdAt: string;
};

type RestoreResult = {
  success: boolean;
  restoredFrom?: string | null;
  autoBackupPath?: string | null;
  error?: string | null;
};

const TABS = [
  "Provider",
  "Ollama",
  "Defaults",
  "Rules",
  "Hooks",
  "MCP",
  "Backup/Restore",
  "Recommendations",
] as const;

type TabName = (typeof TABS)[number];

export function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>("Provider");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading...");
  const [state, setState] = useState<AppState | null>(null);

  const [repoRoot, setRepoRoot] = useState("/home/lancer1977/code");
  const [ruleFiles, setRuleFiles] = useState<string[]>([]);
  const [selectedRuleFile, setSelectedRuleFile] = useState("");
  const [selectedRuleContent, setSelectedRuleContent] = useState("");

  const [mcpConfigPath, setMcpConfigPath] = useState("");
  const [mcpContent, setMcpContent] = useState("{}");

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState("");

  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const loaded = await invoke<AppState>("load_app_state");
      setState(loaded);
      setMcpConfigPath(loaded.defaultMcpPath);
      setStatus("Loaded Cline config files.");
    } catch (error) {
      setStatus(`Load failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveCoreConfig(): Promise<void> {
    if (!state) {
      return;
    }
    try {
      await invoke("save_core_config", {
        config: state.config,
        env: state.env,
      });
      setStatus("Saved config.json + cline.env");
    } catch (error) {
      setStatus(`Save failed: ${String(error)}`);
    }
  }

  async function loadRuleFiles(): Promise<void> {
    if (!state) return;
    try {
      const files = await invoke<string[]>("list_rule_files", {
        repoRoot,
        globalRulesPath: state.globalRulesPath,
      });
      setRuleFiles(files);
      setStatus(`Found ${files.length} rule files`);
    } catch (error) {
      setStatus(`Rule scan failed: ${String(error)}`);
    }
  }

  async function openRule(path: string): Promise<void> {
    try {
      const content = await invoke<string>("read_text_file", { path });
      setSelectedRuleFile(path);
      setSelectedRuleContent(content);
      setStatus(`Opened ${path}`);
    } catch (error) {
      setStatus(`Open failed: ${String(error)}`);
    }
  }

  async function saveRule(): Promise<void> {
    if (!selectedRuleFile) return;
    try {
      await invoke("write_text_file", {
        path: selectedRuleFile,
        content: selectedRuleContent,
      });
      setStatus(`Saved ${selectedRuleFile}`);
    } catch (error) {
      setStatus(`Save failed: ${String(error)}`);
    }
  }

  async function saveHooks(): Promise<void> {
    if (!state) return;
    try {
      await invoke("save_hooks", {
        preHook: state.preHook,
        postHook: state.postHook,
      });
      setStatus("Saved hook scripts");
    } catch (error) {
      setStatus(`Save hooks failed: ${String(error)}`);
    }
  }

  async function loadMcpFile(): Promise<void> {
    if (!mcpConfigPath.trim()) return;
    try {
      const content = await invoke<string>("read_text_file", { path: mcpConfigPath });
      setMcpContent(content);
      setStatus("Loaded MCP file");
    } catch (error) {
      setStatus(`MCP load failed: ${String(error)}`);
    }
  }

  async function saveMcpFile(): Promise<void> {
    if (!mcpConfigPath.trim()) return;
    try {
      await invoke("write_text_file", { path: mcpConfigPath, content: mcpContent });
      setStatus("Saved MCP file");
    } catch (error) {
      setStatus(`MCP save failed: ${String(error)}`);
    }
  }

  async function listModels(): Promise<void> {
    if (!state) return;
    try {
      const models = await invoke<string[]>("list_ollama_models", {
        baseUrl: state.config.ollama.baseUrl,
      });
      setAvailableModels(models);
      setStatus(`Loaded ${models.length} Ollama models`);
    } catch (error) {
      setStatus(`Model list failed: ${String(error)}`);
    }
  }

  async function generateRecommendations(): Promise<void> {
    if (!state) return;
    try {
      const promptContext = {
        config: state.config,
        env: state.env,
        goal: "Recommend better defaults for coding/refactoring/docs modes.",
      };

      const text = await invoke<string>("generate_recommendations", {
        baseUrl: state.config.ollama.baseUrl,
        model: state.config.ollama.model,
        contextJson: JSON.stringify(promptContext, null, 2),
      });
      setRecommendations(text);
      setStatus("Generated recommendations from Ollama");
    } catch (error) {
      setStatus(`Recommendation failed: ${String(error)}`);
    }
  }

  async function backupConfig(): Promise<void> {
    try {
      const result = await invoke<BackupResult>("backup_config");
      if (result.success) {
        setStatus(`Backup created: ${result.backupPath ?? "(unknown path)"}`);
      } else {
        setStatus(`Backup failed: ${result.error ?? "Unknown error"}`);
      }
    } catch (error) {
      setStatus(`Backup failed: ${String(error)}`);
    }
  }

  async function openRestoreModal(): Promise<void> {
    setBackupModalOpen(true);
    setBackupsLoading(true);
    try {
      const files = await invoke<BackupFile[]>("list_backups");
      setBackups(files);
      setStatus(`Loaded ${files.length} backups`);
    } catch (error) {
      setStatus(`Failed to load backups: ${String(error)}`);
    } finally {
      setBackupsLoading(false);
    }
  }

  async function restoreConfig(backupFilename: string): Promise<void> {
    try {
      const result = await invoke<RestoreResult>("restore_config", {
        backupFilename,
      });
      if (result.success) {
        setStatus(
          `Restored config from ${result.restoredFrom ?? backupFilename}` +
            (result.autoBackupPath ? ` (auto-backup: ${result.autoBackupPath})` : "")
        );
        setBackupModalOpen(false);
      } else {
        setStatus(`Restore failed: ${result.error ?? "Unknown error"}`);
      }
    } catch (error) {
      setStatus(`Restore failed: ${String(error)}`);
    }
  }

  const defaultsPreview = useMemo(() => {
    if (!state) return "";
    return JSON.stringify(
      {
        codingBalanced: {
          CLINE_TEMPERATURE: "0.25",
          CLINE_MAX_CONTEXT_TOKENS: "8192",
        },
        refactorSafe: {
          CLINE_TEMPERATURE: "0.1",
          CLINE_MAX_CONTEXT_TOKENS: "16384",
        },
        docsLongContext: {
          CLINE_TEMPERATURE: "0.35",
          CLINE_MAX_CONTEXT_TOKENS: "32768",
        },
      },
      null,
      2
    );
  }, [state]);

  function applyPreset(kind: "coding" | "refactor" | "docs"): void {
    if (!state) return;
    const next = structuredClone(state);
    if (kind === "coding") {
      next.env.CLINE_TEMPERATURE = "0.25";
      next.env.CLINE_MAX_CONTEXT_TOKENS = "8192";
    }
    if (kind === "refactor") {
      next.env.CLINE_TEMPERATURE = "0.1";
      next.env.CLINE_MAX_CONTEXT_TOKENS = "16384";
    }
    if (kind === "docs") {
      next.env.CLINE_TEMPERATURE = "0.35";
      next.env.CLINE_MAX_CONTEXT_TOKENS = "32768";
    }
    setState(next);
    setStatus(`Applied preset: ${kind}`);
  }

  if (loading || !state) {
    return <main className="container">{status}</main>;
  }

  return (
    <main className="container">
      <h1>Cline Configurator</h1>
      <p className="status">{status}</p>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Provider" && (
        <section className="panel">
          <label>Provider</label>
          <input
            value={state.config.provider}
            onChange={(e) =>
              setState({ ...state, config: { ...state.config, provider: e.target.value } })
            }
          />
          <button onClick={saveCoreConfig}>Save</button>
        </section>
      )}

      {activeTab === "Ollama" && (
        <section className="panel">
          <label>Base URL</label>
          <input
            value={state.config.ollama.baseUrl}
            onChange={(e) =>
              setState({
                ...state,
                config: {
                  ...state.config,
                  ollama: { ...state.config.ollama, baseUrl: e.target.value },
                },
              })
            }
          />

          <label>Model</label>
          <input
            value={state.config.ollama.model}
            onChange={(e) =>
              setState({
                ...state,
                config: {
                  ...state.config,
                  ollama: { ...state.config.ollama, model: e.target.value },
                },
              })
            }
          />

          <div className="row">
            <button onClick={listModels}>Fetch Models</button>
            <button onClick={saveCoreConfig}>Save</button>
          </div>

          {availableModels.length > 0 && (
            <ul>
              {availableModels.map((m) => (
                <li key={m}>
                  <button
                    onClick={() =>
                      setState({
                        ...state,
                        config: {
                          ...state.config,
                          ollama: { ...state.config.ollama, model: m },
                        },
                      })
                    }
                  >
                    Use {m}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "Defaults" && (
        <section className="panel">
          <div className="row">
            <button onClick={() => applyPreset("coding")}>Apply Coding (balanced)</button>
            <button onClick={() => applyPreset("refactor")}>Apply Refactor (safe)</button>
            <button onClick={() => applyPreset("docs")}>Apply Docs (long context)</button>
            <button onClick={saveCoreConfig}>Save</button>
          </div>
          <pre>{defaultsPreview}</pre>
        </section>
      )}

      {activeTab === "Rules" && (
        <section className="panel split">
          <div>
            <label>Repo Root</label>
            <input value={repoRoot} onChange={(e) => setRepoRoot(e.target.value)} />
            <div className="row">
              <button onClick={loadRuleFiles}>Scan Rule Files</button>
            </div>
            <ul className="file-list">
              {ruleFiles.map((path) => (
                <li key={path}>
                  <button onClick={() => openRule(path)}>{path}</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label>Editing</label>
            <div className="muted">{selectedRuleFile || "No file selected"}</div>
            <textarea
              rows={24}
              value={selectedRuleContent}
              onChange={(e) => setSelectedRuleContent(e.target.value)}
            />
            <button onClick={saveRule}>Save Rule File</button>
          </div>
        </section>
      )}

      {activeTab === "Hooks" && (
        <section className="panel split">
          <div>
            <label>Pre-run hook</label>
            <textarea
              rows={16}
              value={state.preHook}
              onChange={(e) => setState({ ...state, preHook: e.target.value })}
            />
          </div>
          <div>
            <label>Post-run hook</label>
            <textarea
              rows={16}
              value={state.postHook}
              onChange={(e) => setState({ ...state, postHook: e.target.value })}
            />
          </div>
          <div className="row">
            <button onClick={saveHooks}>Save Hooks</button>
            <span className="muted">Stored in: {state.hooksDir}</span>
          </div>
        </section>
      )}

      {activeTab === "MCP" && (
        <section className="panel">
          <label>MCP Config File Path</label>
          <input value={mcpConfigPath} onChange={(e) => setMcpConfigPath(e.target.value)} />
          <div className="row">
            <button onClick={loadMcpFile}>Load</button>
            <button onClick={saveMcpFile}>Save</button>
          </div>
          <textarea rows={20} value={mcpContent} onChange={(e) => setMcpContent(e.target.value)} />
        </section>
      )}

      {activeTab === "Backup/Restore" && (
        <section className="panel">
          <p className="muted">
            Creates timestamped backups of your Cline config.json and lets you restore from them.
          </p>

          <div className="row">
            <button onClick={backupConfig}>Backup</button>
            <button onClick={openRestoreModal}>Restore…</button>
          </div>

          {backupModalOpen && (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0 }}>Restore from backup</h2>
                  <button onClick={() => setBackupModalOpen(false)}>Close</button>
                </div>

                {backupsLoading && <div className="muted">Loading backups…</div>}

                {!backupsLoading && backups.length === 0 && (
                  <div className="muted">No backups found yet. Click “Backup” to create one.</div>
                )}

                {!backupsLoading && backups.length > 0 && (
                  <ul className="file-list">
                    {backups.map((b) => (
                      <li key={b.filename}>
                        <button onClick={() => restoreConfig(b.filename)}>
                          {b.createdAt} — {b.filename}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "Recommendations" && (
        <section className="panel">
          <p>
            Uses your local Ollama model ({state.config.ollama.model}) to suggest defaults and
            config updates.
          </p>
          <button onClick={generateRecommendations}>Generate Recommendations</button>
          <textarea rows={20} value={recommendations} readOnly />
        </section>
      )}
    </main>
  );
}
