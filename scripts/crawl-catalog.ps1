$ErrorActionPreference = "Stop"
node scripts/crawl-catalog.mjs
exit $LASTEXITCODE
