param([string]$NodeExecutable)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
New-Item -ItemType Directory -Path (Join-Path $projectDirectory 'data') -Force | Out-Null
$env:NODE_NO_WARNINGS = '1'
& $NodeExecutable (Join-Path $projectDirectory 'server.mjs') *>> (Join-Path $projectDirectory 'data/server.log')
exit $LASTEXITCODE
