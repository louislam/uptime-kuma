import urllib.request
import time

push_url = "<PUSH URL>"
interval = 60

while True:
    urllib.request.urlopen(push_url)
    print("Pushed!\n")
    time.sleep(interval)

