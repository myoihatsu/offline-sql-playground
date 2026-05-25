# SQL Playground

> **⚠️ DISCLAIMER — This project was built entirely with [DeepSeek V4 Pro](https://chat.deepseek.com/) (AI coding agent).**
>
> I am a coding newbie. I wanted an offline SQL playground that *just works* — open a file, write queries, see results. No servers, no cloud, no nonsense. Every line of code, every CSS tweak, every feature in this repo was written by DeepSeek V4 Pro based on my prompts. I take zero credit for the code. If you find it useful, awesome. If you find bugs, well — tell the AI. 😄

---

A fully offline, browser-based SQL playground powered by **SQLite (WebAssembly)**. Write queries, see results, browse table data — all client-side, no server required after initial load.

## Features

- **Full SQLite engine** via [sql.js](https://sql.js.org/) (WASM) — runs entirely in the browser
- **Query editor** with SQL syntax highlighting, autocomplete suggestions (keywords, tables, columns), and real-time linting
- **Lint panel** — issues shown inline on the right side of the editor, with hover tooltips for overflow
- **Tables pane** shows actual data from every table (even empty ones show column headers)
- **Console** logs every statement with timestamps, row counts, and errors
- **Results pane** renders the last `SELECT` output as a table
- **Resizable panels** — drag handles to adjust sidebar, editor height, and console/results split
- **Three themes** — Dracula (dark purple), Simple Dark (VSCode-style), Light Blue — click to cycle
- **Persistence** — database saved to IndexedDB, editor content in localStorage, panel sizes saved
- **Import/Export** — open local `.db` files (📂) and download the current database (💾)
- **Sample data** — click 📋 to load a 10-row `employees` table for quick testing
- **In-app reset** — custom modal dialog (no native `confirm()` popups)
- **Offline** — all dependencies bundled locally, no CDN required

## Quick Start

### Option 1: Browser (any OS)
```bash
# Linux / macOS
chmod +x start_def_browser.sh && ./start_def_browser.sh

# Windows (double-click or run)
start_def_browser.bat
# or in PowerShell:
.\start_def_browser.ps1
```

### Option 2: Standalone Electron binary (any OS)
```bash
npm install
npm run build:linux        # → dist/linux-unpacked/sql-playground
npm run build:win          # → dist/win-unpacked/sql-playground.exe
```

### Option 3: Install to app launcher (Linux)
```bash
chmod +x install.sh && ./install.sh
```
This copies the binary to `/opt/sql-playground/` and creates a `.desktop` entry. Search for **"SQL Playground"** in your start menu after installing.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl + Enter` | Run query |
| `Ctrl + Space` | Force autocomplete |
| `Tab` | Accept suggestion (when dropdown is open) / Insert indent |
| `↑` `↓` | Navigate autocomplete suggestions |
| `Enter` | Accept highlighted suggestion |
| `Escape` | Close autocomplete dropdown |

## File Structure

```
├── index.html              # Main HTML
├── style.css               # All styles + 3 themes + modal + lint panel
├── app.js                  # Core logic: query exec, persistence, resize, tables, highlight
├── lint.js                 # SQL linting + autocomplete suggestions
├── sql-wasm.js             # SQLite JS glue (bundled, no CDN)
├── sql-wasm.wasm           # SQLite WASM binary (bundled, no CDN)
├── electron-main.js        # Electron wrapper entry point
├── package.json            # Node/Electron config
├── start.sh                # Launch script (helium-browser, Linux/macOS)
├── start_def_browser.sh    # Launch script (default browser, Linux/macOS)
├── start_def_browser.bat   # Launch script (default browser, Windows CMD)
├── start_def_browser.ps1   # Launch script (default browser, Windows PowerShell)
├── install.sh              # System-wide install script (Linux desktop integration)
├── sql-playground.desktop  # Freedesktop .desktop entry for app launchers
└── README.md
```

## Tech Stack

- **SQLite** via [sql.js](https://sql.js.org/) 1.10.3 (WebAssembly)
- **Vanilla JS** — no frameworks, no build step
- **Electron** (optional) for standalone binaries
- **IndexedDB** for database persistence
- **localStorage** for editor content, theme, and panel sizes

## License

MIT
