import { useMemo } from "react";
import type { AppState } from "../types";

type DefaultsTabProps = {
  env: Record<string, string>;
  onSave: (env: Record<string, string>) => void;
};

const PRESETS = {
  coding: {
    CLINE_TEMPERATURE: "0.25",
    CLINE_MAX_CONTEXT_TOKENS: "8192",
  },
  refactor: {
    CLINE_TEMPERATURE: "0.1",
    CLINE_MAX_CONTEXT_TOKENS: "16384",
  },
  docs: {
    CLINE_TEMPERATURE: "0.35",
    CLINE_MAX_CONTEXT_TOKENS: "32768",
  },
} as const;

export function DefaultsTab({ env, onSave }: DefaultsTabProps): JSX.Element {
  const defaultsPreview = useMemo(() => {
    return JSON.stringify(
      {
        codingBalanced: PRESETS.coding,
        refactorSafe: PRESETS.refactor,
        docsLongContext: PRESETS.docs,
      },
      null,
      2
    );
  }, []);

  function applyPreset(kind: "coding" | "refactor" | "docs"): void {
    const newEnv = { ...env, ...PRESETS[kind] };
    onSave(newEnv);
  }

  return (
    <section className="panel">
      <div className="row">
        <button onClick={() => applyPreset("coding")}>Apply Coding (balanced)</button>
        <button onClick={() => applyPreset("refactor")}>Apply Refactor (safe)</button>
        <button onClick={() => applyPreset("docs")}>Apply Docs (long context)</button>
        <button onClick={() => onSave(env)}>Save</button>
      </div>
      <pre>{defaultsPreview}</pre>
    </section>
  );
}