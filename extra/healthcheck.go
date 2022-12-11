package main

import (
	"crypto/tls"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"runtime"
	"time"
)

func main() {
	isFreeBSD := runtime.GOOS == "freebsd"

	// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
	http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{
		InsecureSkipVerify: true,
	}

	client := http.Client{
		Timeout: 28 * time.Second,
	}

	sslKey := os.Getenv("UPTIME_KUMA_SSL_KEY")
	if len(sslKey) == 0 {
		sslKey = os.Getenv("SSL_KEY")
	}

	sslCert := os.Getenv("UPTIME_KUMA_SSL_CERT")
	if len(sslCert) == 0 {
		sslCert = os.Getenv("SSL_CERT")
	}

	hostname := os.Getenv("UPTIME_KUMA_HOST")
	if len(hostname) == 0 && !isFreeBSD {
		hostname = os.Getenv("HOST")
	}
	if len(hostname) == 0 {
		hostname = "127.0.0.1"
	}

	port := os.Getenv("UPTIME_KUMA_PORT")
	if len(port) == 0 {
		port = os.Getenv("PORT")
	}
	if len(port) == 0 {
		port = "3001"
	}

	protocol := ""
	if len(sslKey) != 0 && len(sslCert) != 0 {
		protocol = "https"
	} else {
		protocol = "http"
	}

	url := protocol + "://" + hostname + ":" + port

	log.Println("Checking " + url)
	resp, err := client.Get(url)

	if err != nil {
		log.Fatalln(err)
	}

	defer resp.Body.Close()

	_, err = ioutil.ReadAll(resp.Body)

	if err != nil {
		log.Fatalln(err)
	}

	log.Printf("Health Check OK [Res Code: %d]\n", resp.StatusCode)

}
