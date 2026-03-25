import { useState } from "react";
import type { ConfigJson } from "../types";
import { tauriService } from "../services/tauri";

type OllamaTabProps = {
  config: ConfigJson;
  onSave: (config: ConfigJson) => void;
};

export function OllamaTab({ config, onSave }: OllamaTabProps): JSX.Element {
  const [localConfig, setLocalConfig] = useState(config);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  async function handleFetchModels(): Promise<void> {
    const models = await tauriService.listOllamaModels(localConfig.ollama.baseUrl);
    setAvailableModels(models);
  }

  function handleModelSelect(model: string): void {
    setLocalConfig({
      ...localConfig,
      ollama: { ...localConfig.ollama, model },
    });
  }

  return (
    <section className="panel">
      <label>Base URL</label>
      <input
        value={localConfig.ollama.baseUrl}
        onChange={(e) =>
          setLocalConfig({
            ...localConfig,
            ollama: { ...localConfig.ollama, baseUrl: e.target.value },
          })
        }
      />

      <label>Model</label>
      <input
        value={localConfig.ollama.model}
        onChange={(e) =>
          setLocalConfig({
            ...localConfig,
            ollama: { ...localConfig.ollama, model: e.target.value },
          })
        }
      />

      <div className="row">
        <button onClick={handleFetchModels}>Fetch Models</button>
        <button onClick={() => onSave(localConfig)}>Save</button>
      </div>

      {availableModels.length > 0 && (
        <ul>
          {availableModels.map((m) => (
            <li key={m}>
              <button onClick={() => handleModelSelect(m)}>Use {m}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}