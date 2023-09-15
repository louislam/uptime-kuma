const fs = require("fs");
const platform = process.argv[2];

if (!platform) {
    console.error("No platform??");
    process.exit(1);
}

const supportedPlatforms = [
    {
        name: "linux/amd64",
        bin: "./build/uptime-kuma-push-amd64"
    },
    {
        name: "linux/arm64",
        bin: "./build/uptime-kuma-push-arm64"
    },
    {
        name: "linux/arm/v7",
        bin: "./build/uptime-kuma-push-armv7"
    }
];

let platformObj = null;

// Check if the platform is supported
for (let i = 0; i < supportedPlatforms.length; i++) {
    if (supportedPlatforms[i].name === platform) {
        platformObj = supportedPlatforms[i];
        break;
    }
}

if (platformObj) {
    let filename = platformObj.bin;

    if (!fs.existsSync(filename)) {
        console.error(`prebuilt: ${filename} is not found, please build it first`);
        process.exit(1);
    }

    fs.renameSync(filename, "./uptime-kuma-push");
    process.exit(0);
} else {
    console.error("Unsupported platform: " + platform);
    process.exit(1);
}

