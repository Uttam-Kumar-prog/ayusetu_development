#!/usr/bin/env pwsh
# Single startup script: installs deps, starts ngrok tunnels, updates .env.local, and launches backend+frontend
param()

$ErrorActionPreference = 'Stop'

# Determine repository root (parent of this scripts folder)
$ScriptDir = Split-Path -LiteralPath $MyInvocation.MyCommand.Path -Parent
$RootPath = (Resolve-Path (Join-Path $ScriptDir '..')).Path

function Require-Command { param([string]$Name) if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "$Name is not installed or not in PATH." } }

Write-Host "Using project root: $RootPath"

Write-Host "Checking prerequisites..."
Require-Command -Name 'node'
Require-Command -Name 'npm'

# Prefer global ngrok; fallback to npx
$ngrokCmd = 'ngrok'
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
  if (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "'ngrok' not found in PATH; will use 'npx --yes ngrok'."
    $ngrokCmd = 'npx --yes ngrok'
  } else {
    throw "ngrok is not installed and 'npx' is unavailable. Install ngrok or ensure npx is on PATH."
  }
}

Write-Host "Installing dependencies (backend + frontend)..."
Push-Location (Join-Path $RootPath 'backend')
npm install
Pop-Location

Push-Location (Join-Path $RootPath 'frontend')
npm install
Pop-Location

Write-Host "Stopping old node/ngrok processes if any..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Detecting local LAN IP..."
$ipScript = Join-Path $ScriptDir 'get-local-ip.ps1'
if (-not (Test-Path $ipScript)) { throw "Missing helper script: $ipScript" }
$ip = & powershell -NoProfile -ExecutionPolicy Bypass -File $ipScript
if (-not $ip) { throw 'Could not detect local IP.' }
$ip = $ip.Trim()

Write-Host "LAN IP: $ip"

Write-Host "Starting single ngrok process for backend (5000) and frontend (5173)..."
# Start one ngrok process exposing both ports (ngrok v3 supports multiple http tunnels)
$ngrokStartCmd = "cd /d `"$RootPath`" && $ngrokCmd http 5000 5173 --log=stdout"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $ngrokStartCmd -WindowStyle Normal

Write-Host "Waiting for ngrok to publish public URLs..."
$resolveScript = Join-Path $ScriptDir 'resolve-ngrok-urls.ps1'
if (-not (Test-Path $resolveScript)) { throw "Missing helper script: $resolveScript" }

$kvLines = & powershell -NoProfile -ExecutionPolicy Bypass -File $resolveScript -ApiPort 4040 -MaxWaitSeconds 120

$backendPublic = $null
$frontendPublic = $null
foreach ($line in $kvLines) {
  if ($line -like 'BACKEND_PUBLIC=*') { $backendPublic = $line.Substring('BACKEND_PUBLIC='.Length) }
  if ($line -like 'FRONTEND_PUBLIC=*') { $frontendPublic = $line.Substring('FRONTEND_PUBLIC='.Length) }
}

if (-not $backendPublic) { throw 'Could not resolve backend public URL from ngrok.' }
if (-not $frontendPublic) { throw 'Could not resolve frontend public URL from ngrok.' }

Write-Host "ngrok backend:  $backendPublic"
Write-Host "ngrok frontend: $frontendPublic"

Write-Host "Updating .env.local files (backend/.env.local and frontend/.env.local)..."
$configScript = Join-Path $ScriptDir 'configure-env-local.ps1'
if (-not (Test-Path $configScript)) { throw "Missing helper script: $configScript" }
& powershell -NoProfile -ExecutionPolicy Bypass -File $configScript -RootPath $RootPath -LocalIp $ip -FrontendUrl $frontendPublic -BackendUrl $backendPublic

Write-Host "Opening firewall for ports 5000 and 5173 if needed..."
try {
  netsh advfirewall firewall add rule name="AyuSetu Backend 5000" dir=in action=allow protocol=TCP localport=5000 | Out-Null
  netsh advfirewall firewall add rule name="AyuSetu Frontend 5173" dir=in action=allow protocol=TCP localport=5173 | Out-Null
} catch {}

Write-Host "Starting backend (dev) in new terminal..."
$backendCmd = "cd /d `"$RootPath\backend`" && npm run dev"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $backendCmd -WindowStyle Normal

Start-Sleep -Seconds 4

Write-Host "Starting frontend (vite dev) in new terminal..."
$frontendCmd = "cd /d `"$RootPath\frontend`" && npm run dev -- --host 0.0.0.0 --port 5173"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $frontendCmd -WindowStyle Normal

Write-Host ''
Write-Host '===== READY ====='
Write-Host "Public frontend URL: $frontendPublic"
Write-Host "Public backend  URL: $backendPublic"
Write-Host "Keep ngrok and server windows open while sharing the site."
