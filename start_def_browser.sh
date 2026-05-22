#!/usr/bin/env bash
# start_def_browser.sh — Launch with default browser (Linux/macOS)
# If port is already running, just open. Server closes with browser.

set -e
PORT=8765
DIR="$(cd "$(dirname "$0")" && pwd)"

# Detect browser command
if command -v xdg-open >/dev/null 2>&1; then
  BROWSER="xdg-open"
elif command -v open >/dev/null 2>&1; then
  BROWSER="open"          # macOS
elif command -v sensible-browser >/dev/null 2>&1; then
  BROWSER="sensible-browser"
else
  echo "! Cannot detect a browser opener. Install xdg-utils or set BROWSER."
  exit 1
fi

if lsof -i ":$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "→ Port $PORT already in use, opening browser…"
    $BROWSER "http://localhost:$PORT/index.html"
else
    echo "→ Starting server on :$PORT …"
    python3 -m http.server "$PORT" --directory "$DIR" &
    SERVER_PID=$!
    sleep 0.5
    echo "→ Opening browser…"
    $BROWSER "http://localhost:$PORT/index.html"
    echo "→ Shutting down server (pid $SERVER_PID)…"
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
    echo "→ Done."
fi
