Param()

# PowerShell script to backup MySQL using mysqldump (Windows)
if (-not $env:DB_HOST) {
    Write-Error "DB_HOST not set"
    exit 1
}

$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$outDir = Join-Path -Path $PSScriptRoot -ChildPath '..\backups' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $outDir) { New-Item -ItemType Directory -Path (Join-Path -Path $PSScriptRoot -ChildPath '..\backups') | Out-Null }
$outFile = Join-Path -Path $PSScriptRoot -ChildPath "..\backups\$($env:DB_NAME -or 'transporte')_$timestamp.sql"

Write-Host "Starting mysqldump to $outFile"
$mysqldump = "mysqldump.exe"
$args = @(
    "-h", $env:DB_HOST,
    "-P", ($env:DB_PORT -or "3306"),
    "-u", ($env:DB_USER -or "root"),
    "-p$($env:DB_PASSWORD -or '')",
    ($env:DB_NAME -or 'transporte_omar_godoy')
)

& $mysqldump @args > $outFile
if ($LASTEXITCODE -ne 0) { Write-Error "mysqldump failed with code $LASTEXITCODE"; exit $LASTEXITCODE }

Write-Host "Backup written to $outFile"
