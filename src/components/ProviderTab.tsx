import { useState } from "react";
import type { ConfigJson } from "../types";

type ProviderTabProps = {
  config: ConfigJson;
  onSave: (config: ConfigJson) => void;
};

export function ProviderTab({ config, onSave }: ProviderTabProps): JSX.Element {
  const [localConfig, setLocalConfig] = useState(config);

  return (
    <section className="panel">
      <label>Provider</label>
      <input
        value={localConfig.provider}
        onChange={(e) => setLocalConfig({ ...localConfig, provider: e.target.value })}
      />
      <button onClick={() => onSave(localConfig)}>Save</button>
    </section>
  );
}