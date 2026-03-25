import { useState } from "react";
import { tauriService } from "../services/tauri";
import type { ConfigJson } from "../types";

type RecommendationsTabProps = {
  config: ConfigJson;
  env: Record<string, string>;
  onStatusChange: (status: string) => void;
};

export function RecommendationsTab({ config, env, onStatusChange }: RecommendationsTabProps): JSX.Element {
  const [recommendations, setRecommendations] = useState("");

  async function handleGenerate(): Promise<void> {
    try {
      const promptContext = {
        config,
        env,
        goal: "Recommend better defaults for coding/refactoring/docs modes.",
      };

      const text = await tauriService.generateRecommendations(
        config.ollama.baseUrl,
        config.ollama.model,
        JSON.stringify(promptContext, null, 2)
      );
      setRecommendations(text);
      onStatusChange("Generated recommendations from Ollama");
    } catch (error) {
      onStatusChange(`Recommendation failed: ${String(error)}`);
    }
  }

  return (
    <section className="panel">
      <p>
        Uses your local Ollama model ({config.ollama.model}) to suggest defaults and
        config updates.
      </p>
      <button onClick={handleGenerate}>Generate Recommendations</button>
      <textarea rows={20} value={recommendations} readOnly />
    </section>
  );
}