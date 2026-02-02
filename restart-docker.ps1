# Restart Docker Desktop to apply DNS changes
Write-Host "Stopping Docker Desktop..." -ForegroundColor Yellow

# Stop Docker Desktop
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue

# Wait for it to fully stop
Start-Sleep -Seconds 5

Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow

# Start Docker Desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

Write-Host "Waiting for Docker to start (this may take 30-60 seconds)..." -ForegroundColor Yellow

# Wait for Docker to be ready
$maxAttempts = 30
$attempt = 0
$dockerReady = $false

while (-not $dockerReady -and $attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 2
    
    try {
        $result = docker ps 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dockerReady = $true
            Write-Host "Docker is ready!" -ForegroundColor Green
        }
    } catch {
        Write-Host "." -NoNewline
    }
}

if (-not $dockerReady) {
    Write-Host "`nDocker didn't start within expected time. Please check Docker Desktop manually." -ForegroundColor Red
    exit 1
}

Write-Host "`nDocker Desktop restarted successfully!" -ForegroundColor Green
Write-Host "You can now try building again: docker build -t railway-worker ." -ForegroundColor Cyan
