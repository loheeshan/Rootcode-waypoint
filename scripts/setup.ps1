# Creates missing local environment files without overwriting existing values.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
foreach ($relative in @('', 'apps/web', 'apps/api', 'apps/driver-mobile', 'apps/loader-mobile')) {
  $directory = Join-Path $repoRoot $relative
  $target = Join-Path $directory '.env'
  if (-not (Test-Path -LiteralPath $target)) {
    Copy-Item -LiteralPath (Join-Path $directory '.env.example') -Destination $target
    Write-Host "Created $target"
  }
}
Write-Host 'Edit passwords and mobile API URLs, then follow README.md.'
