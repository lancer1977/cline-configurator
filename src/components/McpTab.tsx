import { useState } from "react";
import { tauriService } from "../services/tauri";

type McpTabProps = {
  defaultMcpPath: string;
  onStatusChange: (status: string) => void;
};

export function McpTab({ defaultMcpPath, onStatusChange }: McpTabProps): JSX.Element {
  const [mcpConfigPath, setMcpConfigPath] = useState(defaultMcpPath);
  const [mcpContent, setMcpContent] = useState("{}");

  async function handleLoad(): Promise<void> {
    if (!mcpConfigPath.trim()) return;
    try {
      const content = await tauriService.readTextFile(mcpConfigPath);
      setMcpContent(content);
      onStatusChange("Loaded MCP file");
    } catch (error) {
      onStatusChange(`MCP load failed: ${String(error)}`);
    }
  }

  async function handleSave(): Promise<void> {
    if (!mcpConfigPath.trim()) return;
    try {
      await tauriService.writeTextFile(mcpConfigPath, mcpContent);
      onStatusChange("Saved MCP file");
    } catch (error) {
      onStatusChange(`MCP save failed: ${String(error)}`);
    }
  }

  return (
    <section className="panel">
      <label>MCP Config File Path</label>
      <input value={mcpConfigPath} onChange={(e) => setMcpConfigPath(e.target.value)} />
      <div className="row">
        <button onClick={handleLoad}>Load</button>
        <button onClick={handleSave}>Save</button>
      </div>
      <textarea rows={20} value={mcpContent} onChange={(e) => setMcpContent(e.target.value)} />
    </section>
  );
}