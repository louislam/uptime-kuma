// Script to generate changelog
// Usage: node generate-changelog.mjs <previous-version-tag>
// GitHub CLI (gh command) is required

import * as childProcess from "child_process";

const ignoreList = [
    "louislam",
    "CommanderStorm",
    "UptimeKumaBot",
    "weblate",
    "Copilot"
];

const mergeList = [
    "Translations Update from Weblate",
    "Update dependencies",
];

const template = `

LLM Task: Please help to put above PRs into the following sections based on their content. If a PR fits multiple sections, choose the most relevant one. If a PR doesn't fit any section, place it in "Others". If there are grammatical errors in the PR titles, please correct them. Don't change the PR numbers and authors, and keep the format. Output as markdown.

Changelog:

### 🆕 New Features

### 💇‍♀️ Improvements

### 🐞 Bug Fixes

### ⬆️ Security Fixes

### 🦎 Translation Contributions

### Others
- Other small changes, code refactoring and comment/doc updates in this repo:
`;

await main();

/**
 * Main Function
 * @returns {Promise<void>}
 */
async function main() {
    const previousVersion = process.argv[2];

    if (!previousVersion) {
        console.error("Please provide the previous version as the first argument.");
        process.exit(1);
    }

    console.log(`Generating changelog since version ${previousVersion}...`);

    try {
        const prList = await getPullRequestList(previousVersion);
        const list = [];

        let i = 1;
        for (const pr of prList) {
            console.log(`Progress: ${i++}/${prList.length}`);
            let authorSet = await getAuthorList(pr.number);
            authorSet = await mainAuthorToFront(pr.author.login, authorSet);

            if (mergeList.includes(pr.title)) {
                // Check if it is already in the list
                const existingItem = list.find(item => item.title === pr.title);
                if (existingItem) {
                    existingItem.numbers.push(pr.number);
                    for (const author of authorSet) {
                        existingItem.authors.add(author);
                        // Sort the authors
                        existingItem.authors = new Set([ ...existingItem.authors ].sort((a, b) => a.localeCompare(b)));
                    }
                    continue;
                }
            }

            const item = {
                numbers: [ pr.number ],
                title: pr.title,
                authors: authorSet,
            };

            list.push(item);
        }

        for (const item of list) {
            // Concat pr numbers into a string like #123 #456
            const prPart = item.numbers.map(num => `#${num}`).join(" ");

            // Concat authors into a string like @user1 @user2
            let authorPart = [ ...item.authors ].map(author => `@${author}`).join(" ");

            if (authorPart) {
                authorPart = `(Thanks ${authorPart})`;
            }

            console.log(`- ${prPart} ${item.title} ${authorPart}`);
        }

        console.log(template);

    } catch (e) {
        console.error("Failed to get pull request list:", e);
        process.exit(1);
    }
}

/**
 * @param {string} previousVersion Previous Version Tag
 * @returns {Promise<object>} List of Pull Requests merged since previousVersion
 */
async function getPullRequestList(previousVersion) {
    // Get the date of previousVersion in YYYY-MM-DD format from git
    const previousVersionDate = childProcess.execSync(`git log -1 --format=%cd --date=short ${previousVersion}`).toString().trim();

    if (!previousVersionDate) {
        throw new Error(`Unable to find the date of version ${previousVersion}. Please make sure the version tag exists.`);
    }

    const ghProcess = childProcess.spawnSync("gh", [
        "pr",
        "list",
        "--state",
        "merged",
        "--base",
        "master",
        "--search",
        `merged:>=${previousVersionDate}`,
        "--json",
        "number,title,author",
        "--limit",
        "1000"
    ], {
        encoding: "utf-8"
    });

    if (ghProcess.error) {
        throw ghProcess.error;
    }

    if (ghProcess.status !== 0) {
        throw new Error(`gh command failed with status ${ghProcess.status}: ${ghProcess.stderr}`);
    }

    return JSON.parse(ghProcess.stdout);
}

/**
 * @param {number} prID Pull Request ID
 * @returns {Promise<Set<string>>} Set of Authors' GitHub Usernames
 */
async function getAuthorList(prID) {
    const ghProcess = childProcess.spawnSync("gh", [
        "pr",
        "view",
        prID,
        "--json",
        "commits"
    ], {
        encoding: "utf-8"
    });

    if (ghProcess.error) {
        throw ghProcess.error;
    }

    if (ghProcess.status !== 0) {
        throw new Error(`gh command failed with status ${ghProcess.status}: ${ghProcess.stderr}`);
    }

    const prInfo = JSON.parse(ghProcess.stdout);
    const commits = prInfo.commits;

    const set = new Set();

    for (const commit of commits) {
        for (const author of commit.authors) {
            if (author.login && !ignoreList.includes(author.login)) {
                set.add(author.login);
            }
        }
    }

    // Sort the set
    return new Set([ ...set ].sort((a, b) => a.localeCompare(b)));
}

/**
 * @param {string} mainAuthor Main Author
 * @param {Set<string>} authorSet Set of Authors
 * @returns {Set<string>} New Set with mainAuthor at the front
 */
async function mainAuthorToFront(mainAuthor, authorSet) {
    if (ignoreList.includes(mainAuthor)) {
        return authorSet;
    }
    return new Set([ mainAuthor, ...authorSet ]);
}
