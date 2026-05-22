#!/usr/bin/env bash
# start.sh — Launch SQL Playground with local server + helium-browser
# If port is already running, just open the browser.
# When the browser closes, the server is killed.

set -e
PORT=8765
DIR="$(cd "$(dirname "$0")" && pwd)"

if lsof -i ":$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "→ Port $PORT already in use, opening browser…"
    helium-browser "http://localhost:$PORT/index.html"
else
    echo "→ Starting server on :$PORT …"
    python3 -m http.server "$PORT" --directory "$DIR" &
    SERVER_PID=$!
    sleep 0.5
    echo "→ Opening helium-browser…"
    helium-browser "http://localhost:$PORT/index.html"
    echo "→ Shutting down server (pid $SERVER_PID)…"
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
    echo "→ Done."
fi
