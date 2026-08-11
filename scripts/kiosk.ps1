# ============================================================
#  Service Desk — Control Room Wallboard Kiosk Launcher
#  Opens one fullscreen (kiosk) browser window per monitor,
#  each showing a different IT staff member's wallboard.
#  Keeps each window open, and reopens it if it is closed.
# ============================================================

# ---------- CONFIG (edit these) ----------
# Address of the running system.
#   localhost   = this PC is running the system
#   or use the server's LAN IP (find it with `ipconfig`)
$serverUrl = "http://localhost:3001"

# One staff ID per monitor, in order (left to right).
# Seed staff:
#   usr-003 = Mark Reyes   usr-004 = Ana Cruz   usr-005 = Admin User
# Add more staff in Admin -> Users, then put their ID here.
$staffIds = @("usr-003", "usr-004", "usr-005")

# Browser to use: "edge" (comes with Windows) or "chrome"
$browser = "edge"

# OPTIONAL: force a window onto a specific screen position (X,Y).
# Use only if a window opens on the wrong monitor. Example:
#   $windowOverride = @("0,0", "1920,0")
$windowOverride = @()
# -------------------------------------------

$edgePaths = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$chromePaths = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$browserExe = $null
if ($browser -eq "chrome") {
  foreach ($p in $chromePaths) { if (Test-Path $p) { $browserExe = $p; break } }
} else {
  foreach ($p in $edgePaths) { if (Test-Path $p) { $browserExe = $p; break } }
}
if (-not $browserExe) {
  Write-Host "ERROR: $browser browser not found. Install it or change `$browser at the top of this script." -ForegroundColor Red
  exit 1
}

Add-Type -AssemblyName System.Windows.Forms
$screens = @([System.Windows.Forms.Screen]::AllScreens | Sort-Object { $_.Bounds.Left })

$count = [Math]::Min($screens.Count, $staffIds.Count)
if ($count -lt $staffIds.Count) {
  Write-Host "WARNING: $($staffIds.Count) staff configured but only $($screens.Count) monitor(s) found. Showing the first $count." -ForegroundColor Yellow
}

# One browser profile per screen so each window can be placed on its
# own monitor reliably (separate profiles also keep the watchdog simple).
$profileRoot = Join-Path $env:LOCALAPPDATA "service-desk-kiosk"

function Start-KioskWindow([int]$index, [string]$url, [string]$position, [string]$size) {
  $profile = Join-Path $profileRoot "screen$index"
  $argList = @(
    "--kiosk",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=$profile",
    "--window-position=$position",
    "--window-size=$size",
    $url
  )
  return Start-Process -FilePath $browserExe -ArgumentList $argList -PassThru
}

$processes = @{}
for ($i = 0; $i -lt $count; $i++) {
  $bounds = $screens[$i].Bounds
  $pos = if ($i -lt $windowOverride.Count -and $windowOverride[$i]) { $windowOverride[$i] } else { "$($bounds.X),$($bounds.Y)" }
  $size = "$($bounds.Width),$($bounds.Height)"
  $url = "$serverUrl/wallboard/$($staffIds[$i])"
  $processes[$i] = Start-KioskWindow $i $url $pos $size
  Write-Host "Screen $($i + 1): $url" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Control-room kiosk running on $count screen(s)." -ForegroundColor Green
Write-Host "Keep this window open. Press Ctrl+C to stop."
Write-Host "First-time setup: click a demo account ONCE per screen to log in."

# Watchdog — if any kiosk window is closed, reopen it.
while ($true) {
  Start-Sleep -Seconds 5
  for ($i = 0; $i -lt $count; $i++) {
    $p = $processes[$i]
    if ($null -eq $p -or $p.HasExited) {
      $bounds = $screens[$i].Bounds
      $pos = if ($i -lt $windowOverride.Count -and $windowOverride[$i]) { $windowOverride[$i] } else { "$($bounds.X),$($bounds.Y)" }
      $size = "$($bounds.Width),$($bounds.Height)"
      $url = "$serverUrl/wallboard/$($staffIds[$i])"
      $processes[$i] = Start-KioskWindow $i $url $pos $size
      Write-Host "Reopened screen $($i + 1): $url" -ForegroundColor Yellow
    }
  }
}
