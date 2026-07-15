import { rmSync } from "fs";
import { spawn } from "child_process";

const dataDir = "./data/playwright-test";
const port = "3001";

console.log(`Cleaning up ${dataDir}...`);
rmSync(dataDir, { recursive: true, force: true });

console.log(`Starting server on port ${port}...`);
const proc = spawn("node", ["--import=tsx", "server/server.js", `--port=${port}`, `--data-dir=${dataDir}`], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
});

proc.on("exit", (code) => {
    process.exit(code);
});
