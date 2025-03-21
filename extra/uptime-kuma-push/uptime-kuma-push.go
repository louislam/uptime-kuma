package main

import (
	"fmt"
	"net/http"
	os "os"
	"time"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: uptime-kuma-push <url> [<interval>]")
		os.Exit(1)
	}

	pushURL := os.Args[1]

	var interval time.Duration

	if len(os.Args) >= 3 {
		intervalString, err := time.ParseDuration(os.Args[2] + "s")
		interval = intervalString

		if err != nil {
			fmt.Fprintln(os.Stderr, "Error: Invalid interval", err)
			os.Exit(1)
		}

	} else {
		interval = 60 * time.Second
	}

	for {
		_, err := http.Get(pushURL)
		if err == nil {
			fmt.Print("Pushed!")
		} else {
			fmt.Print("Error: ", err)
		}

		fmt.Println(" Sleeping for", interval)
		time.Sleep(interval)
	}
}
