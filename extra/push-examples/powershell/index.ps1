$pushURL = "https://status.kuma.pet/api/push/XhQE4b4dGI?status=up&msg=OK&ping="
$interval = 60

while ($true) {
    $res = Invoke-WebRequest -Uri $pushURL
    Write-Host "Pushed!"
    Start-Sleep -Seconds $interval
}
