# Yuuka Pack - uninstaller
# ASCII-only wrapper; all messages come from the Node script.
# Any extra arguments are forwarded (e.g. --force-best-effort when the state file is lost).
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[X] Node.js not found." -ForegroundColor Red
    exit 1
}

node (Join-Path $here 'scripts\uninstall.mjs') @args
exit $LASTEXITCODE
