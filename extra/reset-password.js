console.log("== Uptime Kuma Reset Password Tool ==");

console.log("Loading the database");

const Database = require("../server/database");
const { R } = require("redbean-node");
const readline = require("readline");
const { initJWTSecret } = require("../server/util-server");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

(async () => {
    await Database.connect();

    try {
        const user = await R.findOne("user");

        if (! user) {
            throw new Error("user not found, have you installed?");
        }

        console.log("Found user: " + user.username);

        while (true) {
            let password = await question("New Password: ");
            let confirmPassword = await question("Confirm New Password: ");

            if (password === confirmPassword) {
                await user.resetPassword(password);

                // Reset all sessions by reset jwt secret
                await initJWTSecret();

                rl.close();
                break;
            } else {
                console.log("Passwords do not match, please try again.");
            }
        }

        console.log("Password reset successfully.");
    } catch (e) {
        console.error("Error: " + e.message);
    }

    await Database.close();

    console.log("Finished. You should restart the Uptime Kuma server.")
})();

function question(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        })
    });
}
