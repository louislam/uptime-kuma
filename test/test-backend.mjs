import * as childProcess from "child_process";

const version = parseInt(process.version.slice(1).split(".")[0]);

/**
 * Since Node.js 22 introduced a different "node --test" command with glob, we need to run different test commands based on the Node.js version.
 */
if (version < 22) {
    childProcess.execSync("npm run test-backend-20", { stdio: "inherit" });
} else {
    childProcess.execSync("npm run test-backend-22", { stdio: "inherit" });
}
