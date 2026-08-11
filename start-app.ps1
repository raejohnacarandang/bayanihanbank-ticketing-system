param(
  [int]$Port = 3001,
  [int]$TimeoutSec = 30,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$StdOut = Join-Path $Root 'start.log'
$StdErr = Join-Path $Root 'start.err.log'

# 1. Free the port so a stale instance doesn't block the new one (EADDRINUSE).
$old = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($old) {
  foreach ($c in $old) {
    Write-Host "Port $Port is in use by PID $($c.OwningProcess); stopping it..."
    taskkill /PID $c.OwningProcess /T /F | Out-Null
  }
  Start-Sleep -Milliseconds 500
}

# 2. Launch the app. npm start builds server.js (esbuild) then runs it with node.
$p = Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' -WorkingDirectory $Root `
  -RedirectStandardOutput $StdOut -RedirectStandardError $StdErr -WindowStyle Hidden -PassThru

# 3. Poll until the port is listening (no fixed sleep).
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$ready = $false
while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
  Start-Sleep -Milliseconds 250
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    $ready = $true
    break
  }
  if ($p.HasExited) { break }
}

if ($ready) {
  Write-Host ("App ready in {0:N1}s at http://localhost:{1}" -f $sw.Elapsed.TotalSeconds, $Port)
  if (-not $NoBrowser) { Start-Process "http://localhost:$Port" }
} else {
  Write-Error "App did not become ready within ${TimeoutSec}s. See $StdErr"
  exit 1
}
