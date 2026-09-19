# Yuuka Pack - installer
# ASCII-only wrapper; all messages come from the Node script.
# Any extra arguments are forwarded (e.g. --force to reinstall over an existing install).
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[X] Node.js not found. DSH itself needs Node, so this is unexpected." -ForegroundColor Red
    Write-Host "    Install Node 22.19+ first: https://nodejs.org/"
    exit 1
}

node (Join-Path $here 'scripts\install.mjs') @args
exit $LASTEXITCODE
