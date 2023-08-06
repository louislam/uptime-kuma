#!/usr/bin/env node
const path = require("path");
const args = require("args-parser")(process.argv);

// Set the data directory
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

// Change the working directory to the root of the project, so it can read the dist folder
process.chdir(path.join(__dirname, ".."));

if (args.run) {
    require("../server/server");

} else if (args.installService) {

    if (process.platform === "win32") {
        let Service = require("node-windows").Service;

        // Create a new service object
        let svc = new Service({
            name: "Uptime Kuma",
            description: "Uptime Kuma is an easy-to-use self-hosted monitoring tool.",
            script: "C:\\path\\to\\helloworld.js",
            nodeOptions: [
                "--harmony",
                "--max_old_space_size=4096"
            ]
            //, workingDirectory: '...'
            //, allowServiceLogon: true
        });

        // Listen for the "install" event, which indicates the
        // process is available as a service.
        svc.on("install", function () {
            svc.start();
        });

        svc.install();
    } else if (process.platform === "linux") {

    } else {
        console.error("Unable to install service on platform: " + process.platform);
        process.exit(1);
    }

} else if (args.version || args.v) {
    const version = require("../package.json").version;
    console.log("Uptime Kuma version: " + version);

} else {
    console.log(`Usage: uptime-kuma [options]

Options:
    --install-service    Install Uptime Kuma service (Windows and Linux only)
    --uninstall-service  Uninstall Uptime Kuma service
    --run                Run Uptime Kuma directly in the terminal
    --data-dir="your path"    Set the data directory
    --version            Print the version
    --help               Print this help
    `);
}

