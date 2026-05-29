$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location "$projectRoot"
npm run alerts:run
