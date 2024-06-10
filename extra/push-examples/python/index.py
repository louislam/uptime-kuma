import urllib.request
import time

push_url = "https://example.com/api/push/key?status=up&msg=OK&ping="
interval = 60

while True:
    urllib.request.urlopen(push_url)
    print("Pushed!\n")
    time.sleep(interval)
