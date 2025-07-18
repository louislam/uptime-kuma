#!/usr/bin/env node
import { spawn } from "child_process";
import { parsePrName } from "./pr-lib.mjs";

const prName = process.argv[2];

// Pre-check the prName here, so testers don't need to wait until the Docker image is pulled to see the error.
try {
    parsePrName(prName);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

spawn("docker", [
    "run",
    "--rm",
    "-it",
    "-p", "3000:3000",
    "-p", "3001:3001",
    "--pull", "always",
    "-e", `UPTIME_KUMA_GH_REPO=${prName}`,
    "louislam/uptime-kuma:pr-test2"
], {
    stdio: "inherit",
});
