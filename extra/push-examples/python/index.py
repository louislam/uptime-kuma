import urllib.request
import time

push_url = "https://example.com/api/push/key?status=up&msg=OK&ping="
interval = 60
method = "GET"

while True:
    urllib.request.urlopen(urllib.request.Request(push_url, method=method))
    print("Pushed!\n")
    time.sleep(interval)
