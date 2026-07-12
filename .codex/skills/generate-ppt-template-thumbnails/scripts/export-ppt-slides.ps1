[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputDirectory,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$inputItem = Get-Item -LiteralPath $resolvedInput

if (-not $OutputDirectory) {
  $inputRoot = if ($inputItem.PSIsContainer) { $inputItem.FullName } else { $inputItem.DirectoryName }
  $OutputDirectory = Join-Path $inputRoot "thumbnails"
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$workRoot = Join-Path $outputRoot ".work"
New-Item -ItemType Directory -Force -Path $workRoot | Out-Null

$pptFiles = if ($inputItem.PSIsContainer) {
  @(Get-ChildItem -LiteralPath $resolvedInput -Recurse -File -Filter "*.pptx" | Sort-Object FullName)
} else {
  @(Get-Item -LiteralPath $resolvedInput)
}

$pptJobs = @()
foreach ($sourceFile in $pptFiles) {
  # 必须在启动 PowerPoint COM 前读取文件名，避免旧版 Office 影响 FileInfo 属性访问。
  $sourceName = ($sourceFile.Name -replace '(?i)\.pptx$', '')
  $sourceName = $sourceName -replace '[<>:"/\\|?*]', '-'
  if ([string]::IsNullOrWhiteSpace($sourceName)) { $sourceName = "untitled-template" }
  $pptJobs += [pscustomobject]@{ File = $sourceFile; SafeName = $sourceName }
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  inputPath = $resolvedInput
  outputDirectory = $outputRoot
  discovered = $pptJobs.Count
  items = @()
}

$app = $null
$jobNumber = 0
try {
  $app = New-Object -ComObject PowerPoint.Application
  foreach ($pptJob in $pptJobs) {
    $jobNumber++
    $pptFile = $pptJob.File
    # FileInfo 只用于读取，源 PPT 不会被修改或保存。
    $safeName = $pptJob.SafeName
    if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "template-{0:D4}" -f $jobNumber }

    $slideDirectory = Join-Path (Join-Path $workRoot $safeName) "slides"
    $finalThumbnail = Join-Path $outputRoot "${safeName}-thumbnail.png"
    $deck = $null

    try {
      $existingSlides = @()
      if (Test-Path -LiteralPath $slideDirectory) {
        $existingSlides = @(Get-ChildItem -LiteralPath $slideDirectory -File -Filter "slide-*.png")
      }
      if ($existingSlides.Count -gt 0 -and -not $Force) {
        $manifest.items += [ordered]@{
          input = $pptFile.FullName
          slidesDirectory = $slideDirectory
          thumbnail = $finalThumbnail
          slideCount = $existingSlides.Count
          status = "exported"
          message = "Reused existing slide renders"
        }
        continue
      }

      New-Item -ItemType Directory -Force -Path $slideDirectory | Out-Null
      $presentations = $app.Presentations
      $deck = $presentations.Open($pptFile.FullName, -1, -1, 0)
      [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentations)
      $slides = $deck.Slides
      $slideCount = $slides.Count

      for ($index = 1; $index -le $slideCount; $index++) {
        $slide = $slides.Item($index)
        $slidePath = Join-Path $slideDirectory ("slide-{0:D2}.png" -f $index)
        $slide.Export($slidePath, "PNG", 1600, 900)
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($slide)
      }
      [void][Runtime.InteropServices.Marshal]::ReleaseComObject($slides)

      $renderedCount = @(Get-ChildItem -LiteralPath $slideDirectory -File -Filter "slide-*.png").Count
      if ($renderedCount -ne $slideCount) {
        throw "Slide export count mismatch: expected $slideCount, got $renderedCount"
      }

      $manifest.items += [ordered]@{
        input = $pptFile.FullName
        slidesDirectory = $slideDirectory
        thumbnail = $finalThumbnail
        slideCount = $slideCount
        status = "exported"
        message = "Slide rendering completed; thumbnail generation is pending"
      }
    } catch {
      $manifest.items += [ordered]@{
        input = $pptFile.FullName
        slidesDirectory = $slideDirectory
        thumbnail = $finalThumbnail
        slideCount = 0
        status = "failed"
        message = $_.Exception.Message
      }
    } finally {
      if ($deck) {
        $deck.Close()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck)
      }
    }
  }
} finally {
  if ($app) {
    $app.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
  }
}

$manifestPath = Join-Path $outputRoot "thumbnail-manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Output $manifestPath
