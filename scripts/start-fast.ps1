param(
    [int]$Port = 3099
)

$root = Split-Path -Parent $PSScriptRoot
$env:PORT = "$Port"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath "node.exe" -ArgumentList "--import","tsx","server.ts" -WorkingDirectory $root -RedirectStandardOutput "$env:TEMP\start-fast.log" -RedirectStandardError "$env:TEMP\start-fast.err.log" -WindowStyle Hidden -PassThru

$ready = $false
$deadline = (Get-Date).AddSeconds(30)
while (-not $ready -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 150
    try {
        if ((Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 2).ok) { $ready = $true }
    } catch {}
}

if (-not $ready) {
    Write-Output "Timed out waiting for server. See $env:TEMP\start-fast.log and $env:TEMP\start-fast.err.log"
    & taskkill /PID $p.Id /T /F | Out-Null
    exit 1
}

$sw.Stop()
Write-Output ("Ready in {0:N1}s. Stopping..." -f $sw.Elapsed.TotalSeconds)
& taskkill /PID $p.Id /T /F | Out-Null
