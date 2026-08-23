param(
  [string]$OutputPath = "public/catalog.json"
)

$ErrorActionPreference = "Stop"

$sources = @(
  [pscustomobject]@{
    key = "sadhu"
    name = "Sant Sadhu Ram Ji"
    baseUri = [Uri]"https://mediaseva1.dsmynas.net/-%20Sadhu%20Ram%20Ji/"
    rootFile = "- Sadhu Ram Ji.html"
  },
  [pscustomobject]@{
    key = "ajaib"
    name = "Sant Ajaib Singh Ji"
    baseUri = [Uri]"https://mediaseva1.dsmynas.net/-%20Ajaib%20Singh%20Ji/"
    rootFile = "- Ajaib Singh Ji.html"
  }
)

function ConvertFrom-HtmlText {
  param([string]$Value)
  $withoutTags = [regex]::Replace($Value, "(?is)<script\b.*?</script>|<style\b.*?</style>|<[^>]+>", " ")
  $decoded = [Net.WebUtility]::HtmlDecode($withoutTags)
  return ([regex]::Replace($decoded, "\s+", " ")).Trim()
}

function Get-Page {
  param([Uri]$Uri)
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      return (Invoke-WebRequest -Uri $Uri.AbsoluteUri -UseBasicParsing -TimeoutSec 60).Content
    } catch {
      if ($attempt -eq 3) { throw }
      Start-Sleep -Seconds $attempt
    }
  }
}

function Get-FolderEntries {
  param([string]$Html)
  $entries = @()
  $pattern = '(?is)<div[^>]+id=["''](?<id>I\d+SXE\d+)SXP["''][^>]*>.*?<a[^>]+class=["'']SXLP\d+["''][^>]*>(?<name>.*?)</a>.*?</div>'
  foreach ($match in [regex]::Matches($Html, $pattern)) {
    $entries += [pscustomobject]@{
      id = $match.Groups["id"].Value
      name = ConvertFrom-HtmlText $match.Groups["name"].Value
    }
  }
  return @($entries)
}

function New-FolderNode {
  param(
    [string]$Source,
    [string]$RemoteId,
    [string]$Name
  )
  return [pscustomobject][ordered]@{
    id = "$($Source):$RemoteId"
    remoteId = $RemoteId
    source = $Source
    type = "folder"
    name = $Name
    children = @()
    loaded = $false
  }
}

$items = [System.Collections.Generic.List[object]]::new()
foreach ($source in $sources) {
  Write-Host "Reading $($source.name)"
  $rootUri = [Uri]::new($source.baseUri, $source.rootFile)
  $rootHtml = Get-Page $rootUri
  $children = @(
    Get-FolderEntries $rootHtml |
      Where-Object { $_.name -notmatch "(?i)\b(audio|mp3)\b" } |
      ForEach-Object { New-FolderNode -Source $source.key -RemoteId $_.id -Name $_.name }
  )
  $items.Add([pscustomobject][ordered]@{
    id = "source:$($source.key)"
    source = $source.key
    type = "folder"
    name = $source.name
    children = $children
    loaded = $true
  })
}

$castellanoChildren = @(
  New-FolderNode -Source "castellano" -RemoteId "I1SXE93" -Name "Maestro Kirpal con subtitulos"
  New-FolderNode -Source "castellano" -RemoteId "I1SXE113" -Name "Serie Lluvia de Gracia"
)
$items.Add([pscustomobject][ordered]@{
  id = "source:castellano"
  source = "castellano"
  type = "folder"
  name = "Colecciones en castellano"
  children = $castellanoChildren
  loaded = $true
})

$catalog = [pscustomobject][ordered]@{
  title = "MS Videos"
  updatedAt = [DateTime]::UtcNow.ToString("o")
  items = @($items)
}

$resolvedOutput = Join-Path (Get-Location) $OutputPath
$json = $catalog | ConvertTo-Json -Depth 20
[IO.File]::WriteAllText($resolvedOutput, $json, [Text.UTF8Encoding]::new($false))
Write-Host "Saved $($items.Count) video libraries to $resolvedOutput"
