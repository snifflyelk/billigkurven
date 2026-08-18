param(
  [string]$TaskName = "BilligkurvenPriceSyncHourly",
  [string]$IntervalMinutes = "60"
)

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runScript = Join-Path $PSScriptRoot "run-price-sync.ps1"

$runScriptContent = @"
Set-Location "$projectRoot"
if (Test-Path Env:LIVE_PRICING_MAX_PRODUCTS) { Remove-Item Env:LIVE_PRICING_MAX_PRODUCTS }
`$env:LIVE_PRICING_MIN_INTERVAL_HOURS = "6"
`$env:LIVE_PRICING_ENABLE_CATALOG_DISCOVERY = "true"
`$env:LIVE_PRICING_DISCOVERY_MAX_CANDIDATES_PER_PROVIDER = "8000"
`$env:LIVE_PRICING_ODA_SEARCH_PAGES = "80"
`$env:LIVE_PRICING_NG_SEARCH_PAGES = "80"
`$env:LIVE_PRICING_NG_PAGE_SIZE = "250"
npm run prices:sync
"@

[System.IO.File]::WriteAllText($runScript, $runScriptContent, [System.Text.UTF8Encoding]::new($false))

$taskCommand = "powershell.exe"
$taskArgs = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $runScript

schtasks /Create /F /SC MINUTE /MO $IntervalMinutes /TN $TaskName /TR "`"$taskCommand`" $taskArgs" | Out-Host
Write-Host "Scheduled task created: $TaskName (every $IntervalMinutes minutes)"
