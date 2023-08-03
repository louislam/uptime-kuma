#!/usr/bin/env node

if (!process.env.DATA_DIR) {
    if (process.platform === "win32") {
        process.env.DATA_DIR = process.env.LOCALAPPDATA + "\\uptime-kuma\\";
    } else if (process.platform === "linux") {
        process.env.DATA_DIR = process.env.HOME + "/.local/share/uptime-kuma/";
    } else if (process.platform === "darwin") {
        // TODO: Not sure if this is the correct path for macOS
        process.env.DATA_DIR = process.env.HOME + "/Library/Preferences/uptime-kuma/";
    } else {
        console.error("Unable to detect app data directory on platform: " + process.platform);
        console.error("Please set the DATA_DIR environment variable or `--data-dir=` to the directory where you want to store your data.");
        process.exit(1);
    }
}

require("../server/server");
