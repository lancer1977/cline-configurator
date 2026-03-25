import { useState } from "react";
import { tauriService } from "../services/tauri";

type RulesTabProps = {
  globalRulesPath: string;
  onStatusChange: (status: string) => void;
};

export function RulesTab({ globalRulesPath, onStatusChange }: RulesTabProps): JSX.Element {
  const [repoRoot, setRepoRoot] = useState("/home/lancer1977/code");
  const [ruleFiles, setRuleFiles] = useState<string[]>([]);
  const [selectedRuleFile, setSelectedRuleFile] = useState("");
  const [selectedRuleContent, setSelectedRuleContent] = useState("");

  async function handleScanRules(): Promise<void> {
    try {
      const files = await tauriService.listRuleFiles(repoRoot, globalRulesPath);
      setRuleFiles(files);
      onStatusChange(`Found ${files.length} rule files`);
    } catch (error) {
      onStatusChange(`Rule scan failed: ${String(error)}`);
    }
  }

  async function handleOpenRule(path: string): Promise<void> {
    try {
      const content = await tauriService.readTextFile(path);
      setSelectedRuleFile(path);
      setSelectedRuleContent(content);
      onStatusChange(`Opened ${path}`);
    } catch (error) {
      onStatusChange(`Open failed: ${String(error)}`);
    }
  }

  async function handleSaveRule(): Promise<void> {
    if (!selectedRuleFile) return;
    try {
      await tauriService.writeTextFile(selectedRuleFile, selectedRuleContent);
      onStatusChange(`Saved ${selectedRuleFile}`);
    } catch (error) {
      onStatusChange(`Save failed: ${String(error)}`);
    }
  }

  return (
    <section className="panel split">
      <div>
        <label>Repo Root</label>
        <input value={repoRoot} onChange={(e) => setRepoRoot(e.target.value)} />
        <div className="row">
          <button onClick={handleScanRules}>Scan Rule Files</button>
        </div>
        <ul className="file-list">
          {ruleFiles.map((path) => (
            <li key={path}>
              <button onClick={() => handleOpenRule(path)}>{path}</button>
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
        <button onClick={handleSaveRule}>Save Rule File</button>
      </div>
    </section>
  );
}