param(
  [string]$OutputPath = "public/catalog.json"
)

$ErrorActionPreference = "Stop"
$baseUri = [Uri]"https://mediaseva1.dsmynas.net/_%20Sant%20Mat%20Castellano/"
$rootUri = [Uri]::new($baseUri, "_ Sant Mat Castellano.html")
$prefix = "_ Sant Mat Castellano"
$visited = @{}

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
      return (Invoke-WebRequest -Uri $Uri.AbsoluteUri -UseBasicParsing -TimeoutSec 45).Content
    } catch {
      if ($attempt -eq 3) { throw }
      Start-Sleep -Seconds $attempt
    }
  }
}

function Get-FolderEntries {
  param([string]$Html)
  $ids = [System.Collections.Generic.HashSet[string]]::new()
  $idMatches = [regex]::Matches($Html, '(?is)p06\s*\(\s*null\s*,\s*\d+\s*,\s*[''"](?<id>I\d+SXE\d+)[''"]\s*\)')
  foreach ($match in $idMatches) { [void]$ids.Add($match.Groups["id"].Value) }

  $anchors = [regex]::Matches($Html, "(?is)<a\b[^>]*>.*?</a>")
  $entries = @()
  foreach ($id in $ids) {
    $names = @()
    foreach ($anchor in $anchors) {
      if ($anchor.Value -notlike "*$id*") { continue }
      $text = ConvertFrom-HtmlText $anchor.Value
      if ($text) { $names += $text }
    }
    $name = $names | Select-Object -Last 1
    if (-not $name) {
      $nearby = [regex]::Match($Html, "(?is)$([regex]::Escape($id)).{0,1400}?(?<label>[A-Za-zÀ-ÿ0-9][^<>]{1,120})</a>")
      if ($nearby.Success) { $name = ConvertFrom-HtmlText $nearby.Groups["label"].Value }
    }
    if (-not $name) { $name = "Carpeta $id" }
    $entries += [pscustomobject]@{ id = $id; name = $name }
  }
  return @($entries)
}

function Get-StableId {
  param([string]$Value)
  $sha = [Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    $hash = $sha.ComputeHash($bytes)
    return "media-" + ([BitConverter]::ToString($hash).Replace("-", "").Substring(0, 14).ToLowerInvariant())
  } finally {
    $sha.Dispose()
  }
}

function Get-FileEntries {
  param(
    [string]$Html,
    [string[]]$Parents
  )
  $supported = @{
    ".mp4" = "video"; ".m4v" = "video"; ".mov" = "video"; ".webm" = "video"; ".mpg" = "video"; ".mpeg" = "video"
  }
  $entries = @()
  $links = [regex]::Matches($Html, '(?is)<a\b(?<attrs>[^>]*)href\s*=\s*[''"](?<href>[^''"]+)[''"](?<rest>[^>]*)>(?<body>.*?)</a>')
  foreach ($link in $links) {
    $href = [Net.WebUtility]::HtmlDecode($link.Groups["href"].Value).Trim()
    if (-not $href -or $href -match "^(javascript:|#|mailto:)") { continue }
    $cleanHref = ($href -split "[?#]")[0]
    $extension = [IO.Path]::GetExtension($cleanHref).ToLowerInvariant()
    if (-not $supported.ContainsKey($extension)) { continue }

    $name = ConvertFrom-HtmlText $link.Groups["body"].Value
    if (-not $name) { $name = [Uri]::UnescapeDataString([IO.Path]::GetFileName($cleanHref)) }
    $absoluteUri = [Uri]::new($baseUri, $href).AbsoluteUri
    $tailLength = [Math]::Min(300, $Html.Length - ($link.Index + $link.Length))
    $tail = if ($tailLength -gt 0) { $Html.Substring($link.Index + $link.Length, $tailLength) } else { "" }
    $sizeMatch = [regex]::Match($tail, "(?i)(?<size>\d+(?:[.,]\d+)?\s*(?:KB|MB|GB))")
    $size = if ($sizeMatch.Success) { $sizeMatch.Groups["size"].Value.Replace(",", ".") } else { "" }
    $path = (@($Parents) + $name) -join " / "

    $entries += [pscustomobject][ordered]@{
      id = Get-StableId $absoluteUri
      type = $supported[$extension]
      name = $name
      url = $absoluteUri
      size = $size
      path = $path
    }
  }
  return @($entries | Sort-Object name -Unique)
}

function Get-FolderNode {
  param(
    [string]$Id,
    [string]$Name,
    [string[]]$Parents
  )
  if ($visited.ContainsKey($Id)) {
    return [pscustomobject][ordered]@{ id = $Id; type = "folder"; name = $Name; children = @() }
  }
  $visited[$Id] = $true

  $fileName = "$prefix$($Id)SXC.htm"
  $uri = [Uri]::new($baseUri, $fileName)
  Write-Host "Crawling $Name"
  $html = Get-Page $uri
  $currentParents = @($Parents) + $Name
  $children = [System.Collections.Generic.List[object]]::new()

  foreach ($folder in (Get-FolderEntries $html)) {
    $children.Add((Get-FolderNode -Id $folder.id -Name $folder.name -Parents $currentParents))
  }
  foreach ($file in (Get-FileEntries -Html $html -Parents $currentParents)) {
    $children.Add($file)
  }

  return [pscustomobject][ordered]@{
    id = $Id
    type = "folder"
    name = $Name
    children = @($children | Sort-Object @{ Expression = { if ($_.type -eq "folder") { 0 } else { 1 } } }, name)
  }
}

$videos = Get-FolderNode -Id "I0SXE91" -Name "Videos" -Parents @()
$items = @($videos.children)

$catalog = [pscustomobject][ordered]@{
  title = "MS Videos"
  source = $rootUri.AbsoluteUri
  updatedAt = [DateTime]::UtcNow.ToString("o")
  items = $items
}

$resolvedOutput = Join-Path (Get-Location) $OutputPath
$catalog | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $resolvedOutput -Encoding utf8
Write-Host "Saved $($items.Count) video sections to $resolvedOutput"
