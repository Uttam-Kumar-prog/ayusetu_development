param(
  [Parameter(Mandatory = $true)][string]$RootPath,
  [Parameter(Mandatory = $true)][string]$LocalIp,
  [Parameter(Mandatory = $true)][string]$FrontendUrl,
  [Parameter(Mandatory = $true)][string]$BackendUrl
)

$ErrorActionPreference = "Stop"

function Initialize-EnvLocal {
  param(
    [Parameter(Mandatory = $true)][string]$BasePath,
    [Parameter(Mandatory = $true)][string]$LocalPath
  )

  if (Test-Path -LiteralPath $LocalPath) {
    return
  }

  if (Test-Path -LiteralPath $BasePath) {
    Copy-Item -LiteralPath $BasePath -Destination $LocalPath -Force
    return
  }

  [void](New-Item -ItemType File -Path $LocalPath -Force)
}

function Upsert-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )

  if (!(Test-Path -LiteralPath $Path)) {
    [void](New-Item -ItemType File -Path $Path -Force)
  }

  $lines = Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue
  if ($null -eq $lines) {
    $lines = @()
  }

  $pattern = "^\s*" + [Regex]::Escape($Key) + "\s*="
  $found = $false
  $out = New-Object System.Collections.Generic.List[string]

  foreach ($line in $lines) {
    if ($line -match $pattern) {
      if (-not $found) {
        $out.Add("$Key=$Value")
        $found = $true
      }
      continue
    }
    $out.Add($line)
  }

  if (-not $found) {
    $out.Add("$Key=$Value")
  }

  Set-Content -LiteralPath $Path -Value $out -Encoding UTF8
}

$backendBase = Join-Path $RootPath "backend\.env"
$backendLocal = Join-Path $RootPath "backend\.env.local"
$frontendBase = Join-Path $RootPath "frontend\.env"
$frontendLocal = Join-Path $RootPath "frontend\.env.local"

Initialize-EnvLocal -BasePath $backendBase -LocalPath $backendLocal
Initialize-EnvLocal -BasePath $frontendBase -LocalPath $frontendLocal

$lanFrontend = "http://$LocalIp`:5173"
$corsOrigin = "http://localhost:5173,http://127.0.0.1:5173,$lanFrontend,$FrontendUrl"

Upsert-EnvValue -Path $backendLocal -Key "WEB_URL" -Value $FrontendUrl
Upsert-EnvValue -Path $backendLocal -Key "CORS_ORIGIN" -Value $corsOrigin

Upsert-EnvValue -Path $frontendLocal -Key "VITE_API_URL" -Value "$BackendUrl/api"
Upsert-EnvValue -Path $frontendLocal -Key "VITE_SOCKET_URL" -Value $BackendUrl

Write-Output "Updated backend/.env.local and frontend/.env.local successfully."
