param(
  [string]$TaskName = "BilligkurvenPriceSyncHourly",
  [string]$IntervalMinutes = "60"
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$runScript = Join-Path $PSScriptRoot "run-price-sync.ps1"

$runScriptContent = @"
Set-Location "$projectRoot"
`$env:LIVE_PRICING_MAX_PRODUCTS = "80"
`$env:LIVE_PRICING_MIN_INTERVAL_HOURS = "6"
npm run prices:sync
"@

[System.IO.File]::WriteAllText($runScript, $runScriptContent, [System.Text.UTF8Encoding]::new($false))

$taskCommand = "powershell.exe"
$taskArgs = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $runScript

schtasks /Create /F /SC MINUTE /MO $IntervalMinutes /TN $TaskName /TR "`"$taskCommand`" $taskArgs" | Out-Host
Write-Host "Scheduled task created: $TaskName (every $IntervalMinutes minutes)"
