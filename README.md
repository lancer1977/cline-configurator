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

### JavaScript dependencies
```bash
npm install
```

### Native system dependencies (Linux Mint/Ubuntu)

Tauri requires WebKitGTK and build tools. Install with:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libgtk-3-dev \
  pkg-config \
  libglib2.0-dev
```

Or use the one-shot helper script:
```bash
curl -sSf https://raw.githubusercontent.com/tauri-apps/tauri/master/.github/scripts/apt-install.sh | sudo bash
```

### Rust
```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
# Restart terminal after installation
```

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
