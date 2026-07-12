$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle(0, 0, $size, $size)),
  [System.Drawing.Color]::FromArgb(255, 45, 90, 200),
  [System.Drawing.Color]::FromArgb(255, 15, 40, 130),
  [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$g.FillEllipse($brush, 16, 16, ($size - 32), ($size - 32))
$font = New-Object System.Drawing.Font('Segoe UI', 72, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString('POS', $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0, 80, $size, 120)), $sf)
$font.Dispose()
$brush.Dispose()
$g.Dispose()

$desktopRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path (Split-Path $desktopRoot -Parent) -Parent
$paths = @(
  (Join-Path $desktopRoot 'build\icon.png'),
  (Join-Path $desktopRoot 'public\icon.png'),
  (Join-Path $repoRoot 'assets\icons\icon.png')
)
foreach ($p in $paths) {
  $full = [System.IO.Path]::GetFullPath($p)
  $dir = Split-Path $full -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host $full
}
$bmp.Dispose()
