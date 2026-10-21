param([string]$NodeExecutable)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
$logDirectory = Join-Path $projectDirectory 'data'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$env:NODE_NO_WARNINGS = '1'
& $NodeExecutable (Join-Path $PSScriptRoot 'collect.mjs') *>> (Join-Path $logDirectory 'collector.log')
exit $LASTEXITCODE
