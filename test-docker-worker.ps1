# Test Docker Worker with Local Supabase
# This script tests the Railway worker Docker image with local environment

Write-Host "Testing Railway Worker Docker Image" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Build the image
Write-Host "Building Docker image..." -ForegroundColor Yellow
docker build -t railway-worker-test . 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker build succeeded" -ForegroundColor Green
Write-Host ""

# Test with local Supabase (will fail to connect but should start)
Write-Host "Testing worker startup..." -ForegroundColor Yellow
Write-Host ""

$env:SUPABASE_URL = "http://localhost:54321"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
$env:STORAGE_BUCKET = "export-files"
$env:WORKER_ID = "test-worker"
$env:ENABLE_CANARY_EXPORT = "false"
$env:LOG_LEVEL = "info"

# Run worker with timeout (it will try to connect to local Supabase)
$job = Start-Job -ScriptBlock {
    docker run --rm `
        --network host `
        -e SUPABASE_URL=$using:env:SUPABASE_URL `
        -e SUPABASE_SERVICE_ROLE_KEY=$using:env:SUPABASE_SERVICE_ROLE_KEY `
        -e STORAGE_BUCKET=$using:env:STORAGE_BUCKET `
        -e WORKER_ID=$using:env:WORKER_ID `
        -e ENABLE_CANARY_EXPORT=$using:env:ENABLE_CANARY_EXPORT `
        -e LOG_LEVEL=$using:env:LOG_LEVEL `
        railway-worker-test
}

# Wait for 5 seconds to see startup logs
Start-Sleep -Seconds 5

# Get output
$output = Receive-Job -Job $job

# Stop the job
Stop-Job -Job $job
Remove-Job -Job $job

# Display output
Write-Host $output

# Check if worker started successfully
if ($output -match "Worker Ready" -or $output -match "Initializing database client") {
    Write-Host ""
    Write-Host "✅ Worker started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The worker is ready to be deployed to Railway." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Push this image to a container registry (Docker Hub, GitHub Container Registry, etc.)"
    Write-Host "2. Deploy to Railway using the container image"
    Write-Host "3. Configure environment variables in Railway dashboard"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "⚠️  Worker startup had issues" -ForegroundColor Yellow
    Write-Host "Check the output above for errors" -ForegroundColor Yellow
    Write-Host ""
}
