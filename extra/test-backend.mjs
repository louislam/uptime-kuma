// If Node.js >= 22, run `npm run test-backend-node22`, otherwise run `npm run test-backend-node20`
import * as childProcess from "child_process";

const version = parseInt(process.version.slice(1));

console.log(`Node.js version: ${version}`);

if (version >= 22) {
    childProcess.execSync("npm run test-backend-node22", { stdio: "inherit" });
} else {
    childProcess.execSync("npm run test-backend-node20", { stdio: "inherit" });
}
