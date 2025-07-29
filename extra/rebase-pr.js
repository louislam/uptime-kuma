const { execSync } = require("child_process");

/**
 * Rebase a PR onto such as 1.23.X or master
 * @returns {Promise<void>}
 */
async function main() {
    const branch = process.argv[2];

    // Use gh to get current branch's pr id
    let currentBranchPRID = execSync("gh pr view --json number --jq \".number\"").toString().trim();
    console.log("Pr ID: ", currentBranchPRID);

    // Use gh commend to get pr commits
    const prCommits = JSON.parse(execSync(`gh pr view ${currentBranchPRID} --json commits`).toString().trim()).commits;

    console.log("Found commits: ", prCommits.length);

    // Sort the commits by authoredDate
    prCommits.sort((a, b) => {
        return new Date(a.authoredDate) - new Date(b.authoredDate);
    });

    // Get the oldest commit id
    const oldestCommitID = prCommits[0].oid;
    console.log("Oldest commit id of this pr:", oldestCommitID);

    // Get the latest commit id of the target branch
    const latestCommitID = execSync(`git rev-parse origin/${branch}`).toString().trim();
    console.log("Latest commit id of " + branch + ":", latestCommitID);

    // Get the original parent commit id of the oldest commit
    const originalParentCommitID = execSync(`git log --pretty=%P -n 1 "${oldestCommitID}"`).toString().trim();
    console.log("Original parent commit id of the oldest commit:", originalParentCommitID);

    // Rebase the pr onto the target branch
    execSync(`git rebase --onto ${latestCommitID} ${originalParentCommitID}`);
}

main();
