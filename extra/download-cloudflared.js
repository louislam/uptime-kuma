//

const http = require("https"); // or 'https' for https:// URLs
const fs = require("fs");

const platform = process.argv[2];

if (!platform) {
    console.error("No platform??");
    process.exit(1);
}

let arch = null;

if (platform === "linux/amd64") {
    arch = "amd64";
} else if (platform === "linux/arm64") {
    arch = "arm64";
} else if (platform === "linux/arm/v7") {
    arch = "arm";
} else {
    console.error("Invalid platform?? " + platform);
}

const file = fs.createWriteStream("cloudflared.deb");
get("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-" + arch + ".deb");

function get(url) {
    http.get(url, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            console.log("Redirect to " + res.headers.location);
            get(res.headers.location);
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
            res.pipe(file);

            res.on("end", function () {
                console.log("Downloaded");
            });
        } else {
            console.error(res.statusCode);
            process.exit(1);
        }
    });
}
