<?php
const PUSH_URL = "https://example.com/api/push/key?status=up&msg=OK&ping=";
const interval = 60;

while (true) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, PUSH_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_exec($ch);
    curl_close($ch);
    echo "Pushed!\n";
    sleep(interval);
}
