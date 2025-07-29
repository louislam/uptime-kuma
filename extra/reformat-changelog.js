// Generate on GitHub
const input = `
* Add Korean translation by @Alanimdeo in https://github.com/louislam/dockge/pull/86
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
