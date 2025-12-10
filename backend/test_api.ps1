# Test API Script

# Register a user
Write-Host "Testing registration..." -ForegroundColor Green
$body = @{
    email = "test@example.com"
    password = "password123"
    password_confirmation = "password123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/auth/register" -ContentType "application/json" -Body $body
    Write-Host "Registration successful!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $_.ErrorDetails.Message
}
