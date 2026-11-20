package main

import (
	"fmt"
	"net/http"
	"time"
)

func main() {
	const PushURL = "https://example.com/api/push/key?status=up&msg=OK&ping="
	const Interval = 60
	const Method = "GET"

	for {
		req, _ := http.NewRequest(Method, PushURL, nil)
		res, err := http.DefaultClient.Do(req)
		if err == nil {
			res.Body.Close()
			fmt.Println("Pushed!")
		}
		time.Sleep(Interval * time.Second)
	}
}
