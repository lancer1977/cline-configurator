import { useState } from "react";
import { tauriService } from "./services/tauri";
import type { AppState, ConfigJson } from "./types";
import { ProviderTab } from "./components/ProviderTab";
import { OllamaTab } from "./components/OllamaTab";
import { DefaultsTab } from "./components/DefaultsTab";
import { RulesTab } from "./components/RulesTab";
import { HooksTab } from "./components/HooksTab";
import { McpTab } from "./components/McpTab";
import { BackupRestoreTab } from "./components/BackupRestoreTab";
import { RecommendationsTab } from "./components/RecommendationsTab";

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

  useState(() => {
    void load();
  });

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const loaded = await tauriService.loadAppState();
      setState(loaded);
      setStatus("Loaded Cline config files.");
    } catch (error) {
      setStatus(`Load failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(config: ConfigJson, env?: Record<string, string>): Promise<void> {
    if (!state) return;
    const newState = { ...state, config };
    if (env) {
      newState.env = env;
    }
    setState(newState);
    try {
      await tauriService.saveCoreConfig(config, env ?? state.env);
      setStatus("Saved config.json + cline.env");
    } catch (error) {
      setStatus(`Save failed: ${String(error)}`);
    }
  }

  async function handleSaveEnv(env: Record<string, string>): Promise<void> {
    if (!state) return;
    setState({ ...state, env });
    try {
      await tauriService.saveCoreConfig(state.config, env);
      setStatus("Saved config.json + cline.env");
    } catch (error) {
      setStatus(`Save failed: ${String(error)}`);
    }
  }

  async function handleSaveHooks(preHook: string, postHook: string): Promise<void> {
    if (!state) return;
    setState({ ...state, preHook, postHook });
    try {
      await tauriService.saveHooks(preHook, postHook);
      setStatus("Saved hook scripts");
    } catch (error) {
      setStatus(`Save hooks failed: ${String(error)}`);
    }
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
        <ProviderTab config={state.config} onSave={(c) => handleSaveConfig(c)} />
      )}

      {activeTab === "Ollama" && (
        <OllamaTab config={state.config} onSave={(c) => handleSaveConfig(c)} />
      )}

      {activeTab === "Defaults" && (
        <DefaultsTab env={state.env} onSave={(e) => handleSaveEnv(e)} />
      )}

      {activeTab === "Rules" && (
        <RulesTab globalRulesPath={state.globalRulesPath} onStatusChange={setStatus} />
      )}

      {activeTab === "Hooks" && (
        <HooksTab
          preHook={state.preHook}
          postHook={state.postHook}
          hooksDir={state.hooksDir}
          onSave={handleSaveHooks}
        />
      )}

      {activeTab === "MCP" && (
        <McpTab defaultMcpPath={state.defaultMcpPath} onStatusChange={setStatus} />
      )}

      {activeTab === "Backup/Restore" && <BackupRestoreTab onStatusChange={setStatus} />}

      {activeTab === "Recommendations" && (
        <RecommendationsTab config={state.config} env={state.env} onStatusChange={setStatus} />
      )}
    </main>
  );
}