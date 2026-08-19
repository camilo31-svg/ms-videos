param(
  [string]$OutputDirectory = "public"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-RoundedPath {
  param(
    [Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-AppIcon {
  param([int]$Size)

  $scale = $Size / 512
  $bitmap = [Drawing.Bitmap]::new($Size, $Size)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([Drawing.Color]::Transparent)

  $background = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("#17211f"))
  $shell = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("#f7faf8"))
  $screen = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("#176b5d"))
  $accent = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("#efb43f"))
  $accentPen = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml("#efb43f"), 18 * $scale)
  $accentPen.StartCap = [Drawing.Drawing2D.LineCap]::Round
  $accentPen.EndCap = [Drawing.Drawing2D.LineCap]::Round

  $outer = New-RoundedPath ([Drawing.RectangleF]::new(18 * $scale, 18 * $scale, 476 * $scale, 476 * $scale)) (76 * $scale)
  $tv = New-RoundedPath ([Drawing.RectangleF]::new(70 * $scale, 132 * $scale, 372 * $scale, 240 * $scale)) (46 * $scale)
  $display = New-RoundedPath ([Drawing.RectangleF]::new(98 * $scale, 158 * $scale, 316 * $scale, 188 * $scale)) (26 * $scale)

  $graphics.FillPath($background, $outer)
  $graphics.DrawLine($accentPen, 206 * $scale, 132 * $scale, 160 * $scale, 78 * $scale)
  $graphics.DrawLine($accentPen, 306 * $scale, 132 * $scale, 352 * $scale, 78 * $scale)
  $graphics.FillPath($shell, $tv)
  $graphics.FillPath($screen, $display)
  $graphics.FillRectangle($shell, 142 * $scale, 370 * $scale, 54 * $scale, 34 * $scale)
  $graphics.FillRectangle($shell, 316 * $scale, 370 * $scale, 54 * $scale, 34 * $scale)

  $play = [Drawing.Drawing2D.GraphicsPath]::new()
  $play.AddPolygon([Drawing.PointF[]]@(
    [Drawing.PointF]::new(222 * $scale, 199 * $scale),
    [Drawing.PointF]::new(222 * $scale, 305 * $scale),
    [Drawing.PointF]::new(312 * $scale, 252 * $scale)
  ))
  $graphics.FillPath($accent, $play)

  $play.Dispose()
  $outer.Dispose()
  $tv.Dispose()
  $display.Dispose()
  $background.Dispose()
  $shell.Dispose()
  $screen.Dispose()
  $accent.Dispose()
  $accentPen.Dispose()
  $graphics.Dispose()
  return $bitmap
}

function New-BrandCard {
  param(
    [int]$Width,
    [int]$Height,
    [Drawing.Bitmap]$Icon
  )

  $bitmap = [Drawing.Bitmap]::new($Width, $Height)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([Drawing.ColorTranslator]::FromHtml("#17211f"))

  $panelBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("#21302c"))
  $linePen = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml("#36534b"), 2)
  $titleBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("#ffffff"))
  $accentBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("#efb43f"))
  $mutedBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml("#c3d0cc"))
  $panel = New-RoundedPath ([Drawing.RectangleF]::new(48, 48, $Width - 96, $Height - 96)) 22
  $graphics.FillPath($panelBrush, $panel)
  $graphics.DrawPath($linePen, $panel)

  $iconSize = [Math]::Min(360, $Height - 150)
  $iconY = [int](($Height - $iconSize) / 2)
  $graphics.DrawImage($Icon, [Drawing.Rectangle]::new(90, $iconY, $iconSize, $iconSize))

  $titleFont = [Drawing.Font]::new("Segoe UI", 70, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
  $subtitleFont = [Drawing.Font]::new("Segoe UI", 28, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
  $labelFont = [Drawing.Font]::new("Segoe UI", 18, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
  $textX = 500
  $graphics.DrawString("VIDEOS EN CASTELLANO", $labelFont, $accentBrush, $textX, ($Height / 2) - 92)
  $graphics.DrawString("MS Videos", $titleFont, $titleBrush, $textX - 4, ($Height / 2) - 50)
  $graphics.DrawString("Sant Mat Castellano", $subtitleFont, $mutedBrush, $textX, ($Height / 2) + 48)

  $panel.Dispose()
  $panelBrush.Dispose()
  $linePen.Dispose()
  $titleBrush.Dispose()
  $accentBrush.Dispose()
  $mutedBrush.Dispose()
  $titleFont.Dispose()
  $subtitleFont.Dispose()
  $labelFont.Dispose()
  $graphics.Dispose()
  return $bitmap
}

function Save-Png {
  param(
    [Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $temporaryPath = "$Path.$([Guid]::NewGuid().ToString('N')).png"
  $Bitmap.Save($temporaryPath, [Drawing.Imaging.ImageFormat]::Png)
  Copy-Item -LiteralPath $temporaryPath -Destination $Path -Force
  Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
}

$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
$icon512 = New-AppIcon 512
Save-Png -Bitmap $icon512 -Path (Join-Path $output "icon-512.png")

$icon192 = [Drawing.Bitmap]::new(192, 192)
$smallGraphics = [Drawing.Graphics]::FromImage($icon192)
$smallGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$smallGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$smallGraphics.DrawImage($icon512, [Drawing.Rectangle]::new(0, 0, 192, 192))
$smallGraphics.Dispose()
Save-Png -Bitmap $icon192 -Path (Join-Path $output "icon-192.png")
$icon192.Dispose()

$artwork = New-BrandCard -Width 1200 -Height 675 -Icon $icon512
Save-Png -Bitmap $artwork -Path (Join-Path $output "artwork.png")
$artwork.Dispose()

$social = New-BrandCard -Width 1200 -Height 630 -Icon $icon512
Save-Png -Bitmap $social -Path (Join-Path $output "og.png")
$social.Dispose()
$icon512.Dispose()

Write-Host "Generated MS Videos icon and artwork in $output"
