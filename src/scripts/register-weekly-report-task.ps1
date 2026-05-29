param(
  [string]$TaskName = "BilligkurvenWeeklyReport",
  [string]$RunDay = "MON",
  [string]$RunTime = "08:20"
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$runScript = Join-Path $PSScriptRoot "run-weekly-report.ps1"

$runScriptContent = @"
Set-Location "$projectRoot"
npm run weekly-report:run
"@

[System.IO.File]::WriteAllText($runScript, $runScriptContent, [System.Text.UTF8Encoding]::new($false))

$taskCommand = "powershell.exe"
$taskArgs = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $runScript

schtasks /Create /F /SC WEEKLY /D $RunDay /ST $RunTime /TN $TaskName /TR "`"$taskCommand`" $taskArgs" | Out-Host
Write-Host "Scheduled task created: $TaskName (weekly on $RunDay at $RunTime)"
