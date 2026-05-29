param(
  [string]$TaskName = "BilligkurvenDataQualityDaily",
  [string]$RunTime = "02:30"
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$runScript = Join-Path $PSScriptRoot "run-data-quality-audit.ps1"

$runScriptContent = @"
Set-Location "$projectRoot"
npm run prices:quality:audit
"@

[System.IO.File]::WriteAllText($runScript, $runScriptContent, [System.Text.UTF8Encoding]::new($false))

$taskCommand = "powershell.exe"
$taskArgs = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $runScript

schtasks /Create /F /SC DAILY /ST $RunTime /TN $TaskName /TR "`"$taskCommand`" $taskArgs" | Out-Host
Write-Host "Scheduled task created: $TaskName (daily at $RunTime)"
