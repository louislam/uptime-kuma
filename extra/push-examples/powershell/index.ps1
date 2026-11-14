# Filename: index.ps1
$pushURL = "https://example.com/api/push/key?status=up&msg=OK&ping="
$interval = 60
$method = "GET"

while ($true) {
    $res = Invoke-WebRequest -Uri $pushURL -Method $method
    Write-Host "Pushed!"
    Start-Sleep -Seconds $interval
}
