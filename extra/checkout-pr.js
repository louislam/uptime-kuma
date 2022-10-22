const childProcess = require("child_process");

if (!process.env.UPTIME_KUMA_GH_REPO) {
    console.error("Please set a repo to the environment variable 'UPTIME_KUMA_GH_REPO' (e.g. mhkarimi1383:goalert-notification)");
    process.exit(1);
}

let inputArray = process.env.UPTIME_KUMA_GH_REPO.split(":");

if (inputArray.length !== 2) {
    console.error("Invalid format. Please set a repo to the environment variable 'UPTIME_KUMA_GH_REPO' (e.g. mhkarimi1383:goalert-notification)");
}

let name = inputArray[0];
let branch = inputArray[1];

console.log("Checkout pr");

// Checkout the pr
let result = childProcess.spawnSync("git", [ "remote", "add", name, `https://github.com/${name}/uptime-kuma` ]);

console.log(result.stdout.toString());
console.error(result.stderr.toString());

result = childProcess.spawnSync("git", [ "fetch", name, branch ]);

console.log(result.stdout.toString());
console.error(result.stderr.toString());

result = childProcess.spawnSync("git", [ "checkout", `${name}/${branch}`, "--force" ]);

console.log(result.stdout.toString());
console.error(result.stderr.toString());
