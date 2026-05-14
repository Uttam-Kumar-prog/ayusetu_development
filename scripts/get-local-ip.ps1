param()

$ErrorActionPreference = "Stop"

function Test-IsPrivateIpv4 {
  param([string]$Ip)
  return $Ip -match "^(10\.)|(192\.168\.)|(172\.(1[6-9]|2[0-9]|3[0-1])\.)"
}

# Preferred path: parse ipconfig output with adapter context
$virtualAdapterPattern = "WSL|vEthernet|Hyper-V|VirtualBox|VMware|Docker|Loopback|Bluetooth"
$currentAdapter = ""
$fromIpconfig = $null

foreach ($line in (ipconfig)) {
  if ($line -match "adapter\s+(.+):\s*$") {
    $currentAdapter = $Matches[1]
    continue
  }

  if ($line -match "IPv4[^:]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s*$") {
    $candidate = $Matches[1]
    if ($candidate -like "127.*" -or $candidate -like "169.254*") { continue }
    if ($currentAdapter -match $virtualAdapterPattern) { continue }
    if (-not (Test-IsPrivateIpv4 -Ip $candidate)) { continue }
    $fromIpconfig = $candidate
    break
  }
}

$ip = $fromIpconfig

# Fallback path: Get-NetIPAddress
if (-not $ip) {
  $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254*" -and
      $_.InterfaceAlias -notmatch $virtualAdapterPattern -and
      (Test-IsPrivateIpv4 -Ip $_.IPAddress)
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
}

if (-not $ip) {
  throw "Could not detect local private IPv4 address."
}

Write-Output $ip
