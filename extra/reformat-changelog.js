// Generate on GitHub
const input = `
* Change execSync/spawnSync to async by @louislam in https://github.com/louislam/uptime-kuma/pull/4123
* Update gamedig from ~4.1.0 to ^4.2.0 by @louislam in https://github.com/louislam/uptime-kuma/pull/4136
* Default Retries from 1 to 0 by @louislam in https://github.com/louislam/uptime-kuma/pull/4139
* Update apprise from 1.4.5 to 1.6.0 by @louislam in https://github.com/louislam/uptime-kuma/pull/4140
* Add support for /snap/bin/chromium by @louislam in https://github.com/louislam/uptime-kuma/pull/4141
* accessible \`ActionSelect\`/ \`ActionInput\` by @CommanderStorm in https://github.com/louislam/uptime-kuma/pull/4132
* accessible domain selector by @CommanderStorm in https://github.com/louislam/uptime-kuma/pull/4133

`;

const template = `
### 🆕 New Features

### 💇‍♀️ Improvements

### 🐞 Bug Fixes

### ⬆️ Security Fixes

### 🦎 Translation Contributions

### Others
- Other small changes, code refactoring and comment/doc updates in this repo:
`;

const lines = input.split("\n").filter((line) => line.trim() !== "");

for (const line of lines) {
    // Split the last " by "
    const usernamePullRequesURL = line.split(" by ").pop();

    if (!usernamePullRequesURL) {
        console.log("Unable to parse", line);
        continue;
    }

    const [ username, pullRequestURL ] = usernamePullRequesURL.split(" in ");
    const pullRequestID = "#" + pullRequestURL.split("/").pop();
    let message = line.split(" by ").shift();

    if (!message) {
        console.log("Unable to parse", line);
        continue;
    }

    message = message.split("* ").pop();
    console.log("-", pullRequestID, message, `(Thanks ${username})`);
}
console.log(template);
