console.log("== Uptime Kuma Change Username Tool ==");

const Database = require("../server/database");
const { R } = require("redbean-node");
const readline = require("readline");
const { initJWTSecret } = require("../server/util-server");
const User = require("../server/model/user");
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
            let newUsername = await question("New username: ");
            await User.updateUsername(user.id, newUsername);

            // Reset all sessions by reset jwt secret
            await initJWTSecret();

            console.log("Username change successfully.");
        }
    } catch (e) {
        console.error("Error: " + e.message);
    }

    await Database.close();
    rl.close();

    console.log("Finished.");
};

/**
 * Ask question of user
 * @param {string} question Question to ask
 * @returns {Promise<string>} Users response
 */
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
