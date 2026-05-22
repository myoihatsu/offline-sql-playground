# SQL Playground

> **⚠️ DISCLAIMER — This project was built entirely with [DeepSeek V4 Pro](https://platform.deepseek.com/) (AI coding agent).**
>
> I am a coding newbie. I wanted an offline SQL playground that *just works* — open a file, write queries, see results. No servers, no cloud, no nonsense. Every line of code, every CSS tweak, every feature in this repo was written by DeepSeek V4 Pro based on my prompts. I take zero credit for the code. If you find it useful, awesome. If you find bugs, well — tell the AI. 😄

---

A fully offline, browser-based SQL playground powered by **SQLite (WebAssembly)**. Write queries, see results, browse table data — all client-side, no server required after initial load.

## Features

- **Full SQLite engine** via [sql.js](https://sql.js.org/) (WASM) — runs entirely in the browser
- **Query editor** with SQL syntax highlighting, autocomplete suggestions, and real-time linting
- **Tables pane** shows actual data from every table (even empty ones)
- **Console** logs every statement with timestamps, row counts, and errors
- **Results pane** renders the last `SELECT` output as a table
- **Resizable panels** — drag handles to adjust sidebar, editor height, and console/results split
- **Three themes** — Dracula (dark purple), Simple Dark (VSCode-style), Light Blue
- **Persistence** — database saved to IndexedDB, editor content in localStorage, survives refreshes
- **Import/Export** — open local `.db` files and download the current database
- **Offline** — all dependencies bundled locally, no CDN required

## Quick Start

### Linux / macOS
```bash
chmod +x start.sh
./start.sh                 # opens in helium-browser
./start_def_browser.sh     # opens in default browser
```

### Windows
```
start_def_browser.bat      # double-click or run in cmd
.\start_def_browser.ps1    # PowerShell
```

### Build standalone binary (Electron)
```bash
npm install
npm run build:linux        # → dist/linux-unpacked/
npm run build:win          # → dist/win-unpacked/
```

## File Structure

```
ds_sql_playground/
├── index.html             # Main HTML
├── style.css              # All styles + 3 themes
├── app.js                 # Core logic: query exec, persistence, resize, tables
├── lint.js                # SQL linting + autocomplete suggestions
├── sql-wasm.js            # SQLite JS glue (bundled, no CDN)
├── sql-wasm.wasm          # SQLite WASM binary (bundled, no CDN)
├── electron-main.js       # Electron wrapper entry point
├── package.json           # Node/Electron config
├── start.sh               # Launch script (helium-browser)
├── start_def_browser.sh   # Launch script (default browser, Linux/macOS)
├── start_def_browser.bat  # Launch script (default browser, Windows CMD)
├── start_def_browser.ps1  # Launch script (default browser, Windows PowerShell)
└── README.md
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl + Enter` | Run query |
| `Ctrl + Space` | Force autocomplete |
| `Tab` | Accept suggestion (autocomplete open) / Insert indent |
| `↑` `↓` | Navigate autocomplete |
| `Escape` | Close autocomplete |

## Tech Stack

- **SQLite** via [sql.js](https://sql.js.org/) 1.10.3 (WebAssembly)
- **Vanilla JS** — no frameworks, no build step
- **Electron** (optional) for standalone binaries
- **IndexedDB** for database persistence
- **localStorage** for editor content and theme preference

## License

MIT
