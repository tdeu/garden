# Setup ActiveStorage Script
# Run this in the backend directory

Write-Host "Setting up ActiveStorage..." -ForegroundColor Green

# Create storage directory
$storagePath = "storage"
if (-not (Test-Path $storagePath)) {
    New-Item -ItemType Directory -Path $storagePath
    Write-Host "Created storage directory" -ForegroundColor Green
} else {
    Write-Host "Storage directory already exists" -ForegroundColor Yellow
}

# Run migrations
Write-Host "Running database migrations..." -ForegroundColor Green
bundle exec rails db:migrate

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migrations completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "ActiveStorage setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To test, start the Rails server with:" -ForegroundColor Cyan
Write-Host "  bundle exec rails server" -ForegroundColor White
