package main

import (
	"fmt"
	"net/http"
	"time"
)

func main() {
	const PushURL = "https://example.com/api/push/key?status=up&msg=OK&ping="
	const Interval = 60

	for {
		_, err := http.Get(PushURL)
		if err == nil {
			fmt.Println("Pushed!")
		}
		time.Sleep(Interval * time.Second)
	}
}
