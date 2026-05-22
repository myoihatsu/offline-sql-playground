# start_def_browser.ps1 — Launch with default browser (Windows PowerShell)

$PORT = 8765
$DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path

# Detect Python (python3 or python)
$py = if (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } else { "python" }

# Check if port is in use
$inUse = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue

if ($inUse) {
    Write-Host "→ Port $PORT already in use, opening browser…"
    Start-Process "http://localhost:$PORT/index.html"
} else {
    Write-Host "→ Starting server on :$PORT …"
    $server = Start-Process $py -ArgumentList "-m","http.server","$PORT","--directory","$DIR" -PassThru -WindowStyle Hidden

    Start-Sleep -Seconds 0.8

    Write-Host "→ Opening browser…"
    Start-Process "http://localhost:$PORT/index.html"

    Write-Host "→ Shutting down server (pid $($server.Id))…"
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    Write-Host "→ Done."
}
