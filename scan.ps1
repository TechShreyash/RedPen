# ═══════════════════════════════════════════════════════
#  RedPen — Security Vulnerability Scanner
#  Usage: irm <URL>/scan.ps1 | iex
#  Or:    .\scan.ps1
# ═══════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

# Configuration
$REDPEN_API = if ($env:REDPEN_API) { $env:REDPEN_API } else { "https://redpen-api.tashanwin.buzz" }
$ZIP_FILE = Join-Path $env:TEMP "redpen_scan_$(Get-Random).zip"

# ─── Banner ────────────────────────────────
Write-Host ""
Write-Host "  ╔═══════════════════════════════╗" -ForegroundColor Red
Write-Host "  ║     🛡️  RedPen Scanner        ║" -ForegroundColor Red
Write-Host "  ╚═══════════════════════════════╝" -ForegroundColor Red
Write-Host ""

# Check if directory has files
$files = Get-ChildItem -Path . -Force
if (-not $files) {
    Write-Host "Error: Current directory is empty." -ForegroundColor Red
    exit 1
}

$currentDir = (Get-Location).Path
Write-Host "📁 Scanning directory: $currentDir" -ForegroundColor Cyan

# ─── Zip the project ────────────────────────
Write-Host "📦 Zipping project files..." -ForegroundColor Yellow

# Exclusion patterns
$excludeDirs = @("node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build", ".next")
$excludeFiles = @("*.pyc", ".env", "*.zip", ".DS_Store")

# Create a temp directory with filtered files
$tempStaging = Join-Path $env:TEMP "redpen_staging_$(Get-Random)"
New-Item -ItemType Directory -Path $tempStaging -Force | Out-Null

# Copy files, excluding unwanted dirs/files
Get-ChildItem -Path . -Recurse -Force | Where-Object {
    $relativePath = $_.FullName.Substring($currentDir.Length + 1)
    $shouldExclude = $false
    
    foreach ($dir in $excludeDirs) {
        if ($relativePath -like "$dir\*" -or $relativePath -eq $dir) {
            $shouldExclude = $true
            break
        }
    }
    
    if (-not $shouldExclude) {
        foreach ($pattern in $excludeFiles) {
            if ($_.Name -like $pattern) {
                $shouldExclude = $true
                break
            }
        }
    }
    
    -not $shouldExclude
} | ForEach-Object {
    $relativePath = $_.FullName.Substring($currentDir.Length + 1)
    $destPath = Join-Path $tempStaging $relativePath
    
    if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Path $destPath -Force | Out-Null
    } else {
        $destDir = Split-Path $destPath -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item $_.FullName -Destination $destPath -Force
    }
}

# Create zip
Compress-Archive -Path (Join-Path $tempStaging "*") -DestinationPath $ZIP_FILE -Force

# Cleanup staging
Remove-Item -Path $tempStaging -Recurse -Force -ErrorAction SilentlyContinue

$zipSize = "{0:N2} MB" -f ((Get-Item $ZIP_FILE).Length / 1MB)
Write-Host "✓ Created archive ($zipSize)" -ForegroundColor Green

# ─── Upload ────────────────────────────────
Write-Host "🚀 Uploading to RedPen..." -ForegroundColor Yellow

try {
    $response = curl.exe -s -X POST "$REDPEN_API/api/scan" `
        -F "file=@$ZIP_FILE" `
        -H "Accept: application/json"
    
    # Parse JSON response
    $result = $response | ConvertFrom-Json
    
    if ($result.id) {
        Write-Host ""
        Write-Host "✓ Scan complete!" -ForegroundColor Green
        Write-Host "  Findings: $($result.findings_count)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  🔗 View your results:" -ForegroundColor White
        Write-Host "  $($result.url)" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "✗ Scan failed." -ForegroundColor Red
        Write-Host "  $response" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Failed to connect to RedPen backend at $REDPEN_API" -ForegroundColor Red
    Write-Host "  Make sure the backend is running." -ForegroundColor Yellow
    Write-Host "  Error: $_" -ForegroundColor Red
} finally {
    # Cleanup zip
    Remove-Item -Path $ZIP_FILE -Force -ErrorAction SilentlyContinue
}
