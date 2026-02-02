# Test Railway Worker Script
# This script runs the Railway worker container and tests it

Write-Host "=== Railway Worker Test Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "OK: Docker is running" -ForegroundColor Green
Write-Host ""

# Stop and remove existing container if it exists
Write-Host "Cleaning up existing container..." -ForegroundColor Yellow
docker stop railway-worker 2>$null
docker rm railway-worker 2>$null
Write-Host "OK: Cleanup complete" -ForegroundColor Green
Write-Host ""

# Run the worker container
Write-Host "Starting Railway worker container..." -ForegroundColor Yellow
Write-Host "Command: docker run -d --name railway-worker -p 3000:3000 --env-file .env.local railway-worker" -ForegroundColor Gray
Write-Host ""

docker run -d --name railway-worker -p 3000:3000 --env-file .env.local railway-worker

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start worker container" -ForegroundColor Red
    exit 1
}

Write-Host "OK: Container started" -ForegroundColor Green
Write-Host ""

# Wait for worker to initialize
Write-Host "Waiting for worker to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host ""

# Show logs
Write-Host "=== Worker Logs ===" -ForegroundColor Cyan
docker logs railway-worker
Write-Host ""

# Test health endpoint
Write-Host "Testing health endpoint..." -ForegroundColor Yellow
$healthCheckPassed = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "OK: Health check passed!" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    $healthCheckPassed = $true
}
catch {
    Write-Host "ERROR: Health check failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "=== Recent Logs ===" -ForegroundColor Cyan
    docker logs --tail 50 railway-worker
}

Write-Host ""
Write-Host "=== Useful Commands ===" -ForegroundColor Cyan
Write-Host "View logs:        docker logs -f railway-worker" -ForegroundColor Gray
Write-Host "Stop worker:      docker stop railway-worker" -ForegroundColor Gray
Write-Host "Restart worker:   docker restart railway-worker" -ForegroundColor Gray
Write-Host "Remove container: docker rm -f railway-worker" -ForegroundColor Gray
Write-Host ""

if ($healthCheckPassed) {
    Write-Host "SUCCESS: Worker is running and healthy!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Worker started but health check failed. Check logs above." -ForegroundColor Yellow
}
