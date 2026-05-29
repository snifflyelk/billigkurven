Set-Location "C:\Projects\Billigkurven\src"
$env:LIVE_PRICING_MAX_PRODUCTS = "80"
$env:LIVE_PRICING_MIN_INTERVAL_HOURS = "6"
npm run prices:sync