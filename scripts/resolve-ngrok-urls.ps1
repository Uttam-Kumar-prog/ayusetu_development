param(
  [int]$ApiPort = 4040,
  [int]$MaxWaitSeconds = 60
)

$ErrorActionPreference = "Stop"

function Get-TunnelsFromApi {
  param([int]$ApiPort)
  try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/api/tunnels" -Method Get -ErrorAction Stop
    return @($resp.tunnels)
  } catch {
    return @()
  }
}

function Find-PublicUrlByLocalPort {
  param(
    [Parameter(Mandatory=$true)][array]$Tunnels,
    [Parameter(Mandatory=$true)][int]$LocalPort
  )

  foreach ($t in $Tunnels) {
    # Check several possible properties for local address
    $addr = $null
    if ($t.config -and $t.config.addr) { $addr = $t.config.addr }
    if (-not $addr -and $t.addr) { $addr = $t.addr }
    if (-not $addr -and $t.forwarding_url) { $addr = $t.forwarding_url }

    if ($addr -and ($addr -match ":$LocalPort`$" -or $addr -match ":$LocalPort/" -or $addr -match ":$LocalPort\b")) {
      if ($t.public_url) { return $t.public_url }
    }
  }

  # Fallback: return first https public_url
  foreach ($t in $Tunnels) { if ($t.public_url -match '^https://') { return $t.public_url } }
  foreach ($t in $Tunnels) { if ($t.public_url) { return $t.public_url } }

  return $null
}

$backendUrl = $null
$frontendUrl = $null
$deadline = (Get-Date).AddSeconds($MaxWaitSeconds)

while ((Get-Date) -lt $deadline) {
  $tunnels = Get-TunnelsFromApi -ApiPort $ApiPort
  if ($tunnels.Count -gt 0) {
    $backendUrl = Find-PublicUrlByLocalPort -Tunnels $tunnels -LocalPort 5000
    $frontendUrl = Find-PublicUrlByLocalPort -Tunnels $tunnels -LocalPort 5173
    if ($backendUrl -and $frontendUrl) { break }
  }
  Start-Sleep -Milliseconds 800
}

if ($backendUrl) { Write-Output "BACKEND_PUBLIC=$backendUrl" }
if ($frontendUrl) { Write-Output "FRONTEND_PUBLIC=$frontendUrl" }
