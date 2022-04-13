console.log("== Uptime Kuma Reset Password Tool ==");

const Database = require("../server/database");
const { R } = require("redbean-node");
const readline = require("readline");
const { initJWTSecret } = require("../server/util-server");
const args = require("args-parser")(process.argv);
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const main = async () => {
    console.log("Connecting the database");
    Database.init(args);
    await Database.connect(false, false, true);

    try {
        // No need to actually reset the password for testing, just make sure no connection problem. It is ok for now.
        if (!process.env.TEST_BACKEND) {
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

                    break;
                } else {
                    console.log("Passwords do not match, please try again.");
                }
            }
            console.log("Password reset successfully.");
        }
    } catch (e) {
        console.error("Error: " + e.message);
    }

    await Database.close();
    rl.close();

    console.log("Finished.");
};

function question(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

if (!process.env.TEST_BACKEND) {
    main();
}

module.exports = {
    main,
};
