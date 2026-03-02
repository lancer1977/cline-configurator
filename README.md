# Cline Configurator

Desktop GUI for managing Cline CLI configuration with tabs for:

- Provider
- Ollama
- Defaults
- Rules (repo + global)
- Hooks
- MCP
- Recommendations (via local Ollama)

## What it edits

- `~/.config/cline/config.json`
- `~/.config/cline/cline.env`
- `~/.config/cline/hooks/pre_run.sh`
- `~/.config/cline/hooks/post_run.sh`
- `~/.config/cline/mcp.json` (default path, editable in UI)

## Dev prerequisites

- Node.js + npm
- Rust toolchain
- Tauri Linux dependencies (webkit2gtk, etc.)

## Run

```bash
cd /home/lancer1977/code/cline-configurator
npm install
npm run tauri dev
```

## Build frontend only

```bash
cd /home/lancer1977/code/cline-configurator
npm run build
```

## Notes

- Recommendations call Ollama at `config.ollama.baseUrl` using `/api/generate`.
- Model list uses `/api/tags`.
- Rules tab scans both repo-local `.cline/**/*.md` and global rules directory (`~/Documents/Cline/Rules`).
