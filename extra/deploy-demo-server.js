require("dotenv").config();
const { NodeSSH } = require("node-ssh");
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin,
    output: process.stdout });
const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

(async () => {
    try {
        console.log("SSH to demo server");
        const ssh = new NodeSSH();
        await ssh.connect({
            host: process.env.UPTIME_KUMA_DEMO_HOST,
            port: process.env.UPTIME_KUMA_DEMO_PORT,
            username: process.env.UPTIME_KUMA_DEMO_USERNAME,
            privateKeyPath: process.env.UPTIME_KUMA_DEMO_PRIVATE_KEY_PATH
        });

        let cwd = process.env.UPTIME_KUMA_DEMO_CWD;
        let result;

        const version = await prompt("Enter Version: ");

        result = await ssh.execCommand("git fetch --all", {
            cwd,
        });
        console.log(result.stdout + result.stderr);

        await prompt("Press any key to continue...");

        result = await ssh.execCommand(`git checkout ${version} --force`, {
            cwd,
        });
        console.log(result.stdout + result.stderr);

        result = await ssh.execCommand("npm run download-dist", {
            cwd,
        });
        console.log(result.stdout + result.stderr);

        result = await ssh.execCommand("npm install --production", {
            cwd,
        });
        console.log(result.stdout + result.stderr);

        /*
        result = await ssh.execCommand("pm2 restart 1", {
            cwd,
        });
        console.log(result.stdout + result.stderr);*/

    } catch (e) {
        console.log(e);
    } finally {
        rl.close();
    }
})();

// When done reading prompt, exit program
rl.on("close", () => process.exit(0));
