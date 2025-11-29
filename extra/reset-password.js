console.log("== Uptime Kuma Reset Password Tool ==");

const Database = require("../server/database");
const { R } = require("redbean-node");
const readline = require("readline");
const { passwordStrength } = require("check-password-strength");
const { initJWTSecret } = require("../server/util-server");
const User = require("../server/model/user");
const { io } = require("socket.io-client");
const { localWebSocketURL } = require("../server/config");
const args = require("args-parser")(process.argv);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const main = async () => {
    if ("dry-run" in args) {
        console.log("Dry run mode, no changes will be made.");
    }

    console.log("Connecting the database");

    try {
        Database.initDataDir(args);
        await Database.connect(false, false, true);
        // No need to actually reset the password for testing, just make sure no connection problem. It is ok for now.
        if (!process.env.TEST_BACKEND) {
            const user = await R.findOne("user");
            if (! user) {
                throw new Error("user not found, have you installed?");
            }

            console.log("Found user: " + user.username);

            while (true) {
                let password;
                let confirmPassword;

                // When called with "--new-password" argument for unattended modification (e.g. npm run reset-password -- --new_password=secret)
                if ("new-password" in args) {
                    console.log("Using password from argument");
                    console.warn("\x1b[31m%s\x1b[0m", "Warning: the password might be stored, in plain text, in your shell's history");
                    password = confirmPassword = args["new-password"] + "";
                    if (passwordStrength(password).value === "Too weak") {
                        throw new Error("Password is too weak, please use a stronger password.");
                    }
                } else {
                    password = await question("New Password: ");
                    if (passwordStrength(password).value === "Too weak") {
                        console.log("Password is too weak, please try again.");
                        continue;
                    }
                    confirmPassword = await question("Confirm New Password: ");
                }

                if (password === confirmPassword) {
                    if (!("dry-run" in args)) {
                        await User.resetPassword(user.id, password);

                        // Reset all sessions by reset jwt secret
                        await initJWTSecret();

                        // Disconnect all other socket clients of the user
                        await disconnectAllSocketClients(user.username, password);
                    }
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

/**
 * Disconnect all socket clients of the user
 * @param {string} username Username
 * @param {string} password Password
 * @returns {Promise<void>} Promise
 */
function disconnectAllSocketClients(username, password) {
    return new Promise((resolve) => {
        console.log("Connecting to " + localWebSocketURL + " to disconnect all other socket clients");

        // Disconnect all socket connections
        const socket = io(localWebSocketURL, {
            reconnection: false,
            timeout: 5000,
        });
        socket.on("connect", () => {
            socket.emit("login", {
                username,
                password,
            }, (res) => {
                if (res.ok) {
                    console.log("Logged in.");
                    socket.emit("disconnectOtherSocketClients");
                } else {
                    console.warn("Login failed.");
                    console.warn("Please restart the server to disconnect all sessions.");
                }
                socket.close();
            });
        });

        socket.on("connect_error", function () {
            // The localWebSocketURL is not guaranteed to be working for some complicated Uptime Kuma setup
            // Ask the user to restart the server manually
            console.warn("Failed to connect to " + localWebSocketURL);
            console.warn("Please restart the server to disconnect all sessions manually.");
            resolve();
        });
        socket.on("disconnect", () => {
            resolve();
        });
    });
}

if (!process.env.TEST_BACKEND) {
    main();
}

module.exports = {
    main,
};
