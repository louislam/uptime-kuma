const childProcess = require("child_process");

if (!process.env.UPTIME_KUMA_PRUPTIME_KUMA_PR) {
    console.error("Please set a pull request number to the environment variable 'UPTIME_KUMA_PRUPTIME_KUMA_PR'");
    process.exit(1);
}

console.log("Checkout pr");

// Checkout the pr
childProcess.spawnSync("gh", [ "pr", "checkout", process.env.UPTIME_KUMA_PR ]);
