package main

import (
	"fmt"
	"net/http"
	"time"
)

func main() {
	const pushURL = "https://example.com/api/push/key?status=up&msg=OK&ping="
	const interval = 60

	ticker := time.NewTicker(interval * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		_, err := http.Get(pushURL)
		if err == nil {
			fmt.Println("Pushed!")
		}
	}
}
