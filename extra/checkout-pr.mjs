import childProcess from "child_process";
import { parsePrName } from "./kuma-pr/pr-lib.mjs";

let { name, branch } = parsePrName(process.env.UPTIME_KUMA_GH_REPO);

console.log(`Checking out PR from ${name}:${branch}`);

// Checkout the pr
let result = childProcess.spawnSync("git", [ "remote", "add", name, `https://github.com/${name}/uptime-kuma` ], {
    stdio: "inherit"
});

if (result.status !== 0) {
    console.error("Failed to add remote repository.");
    process.exit(1);
}

result = childProcess.spawnSync("git", [ "fetch", name, branch ], {
    stdio: "inherit"
});

if (result.status !== 0) {
    console.error("Failed to fetch the branch.");
    process.exit(1);
}

result = childProcess.spawnSync("git", [ "checkout", `${name}/${branch}`, "--force" ], {
    stdio: "inherit"
});

if (result.status !== 0) {
    console.error("Failed to checkout the branch.");
    process.exit(1);
}
