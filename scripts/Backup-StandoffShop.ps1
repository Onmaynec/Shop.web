param(
  [string]$OutputDirectory = ".\\backups"
)
$ErrorActionPreference = "Stop"
$backupName = "standoffshop-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump"
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$destination = Join-Path (Resolve-Path $OutputDirectory) $backupName

Write-Host "Creating a PostgreSQL custom-format backup..."
docker compose exec -T postgres pg_dump -U standoffshop -d standoffshop -Fc -f /tmp/standoffshop-export.dump
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed, no backup created" }

Write-Host "Verifying PostgreSQL archive metadata..."
docker compose exec -T postgres pg_restore --list /tmp/standoffshop-export.dump | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pg_restore validation failed" }

Write-Host "Copying backup to $destination ..."
docker compose cp postgres:/tmp/standoffshop-export.dump $destination
if ($LASTEXITCODE -ne 0) { throw "Failed to copy database backup" }

if ((Get-Item $destination).Length -le 0) { throw "Backup is empty" }
Write-Host "Backup saved: $destination"
Write-Host "Test restoration in a SEPARATE database before depending on this archive."
