const github = require("@actions/github");

(async () => {
    try {
        const token = process.argv[2];
        const issueNumber = process.argv[3];
        const username = process.argv[4];

        const client = github.getOctokit(token).rest;

        const issue = {
            owner: "louislam",
            repo: "uptime-kuma",
            number: issueNumber,
        };

        const labels = (
            await client.issues.listLabelsOnIssue({
                owner: issue.owner,
                repo: issue.repo,
                issue_number: issue.number
            })
        ).data.map(({ name }) => name);

        if (labels.length === 0) {
            console.log("Bad format here");

            await client.issues.addLabels({
                owner: issue.owner,
                repo: issue.repo,
                issue_number: issue.number,
                labels: [ "invalid-format" ]
            });

            // Add the issue closing comment
            await client.issues.createComment({
                owner: issue.owner,
                repo: issue.repo,
                issue_number: issue.number,
                body: `@${username}: Hello! :wave:\n\nThis issue is being automatically closed because it does not follow the issue template. Please **DO NOT open blank issues and use our [issue-templates](https://github.com/louislam/uptime-kuma/issues/new/choose) instead**.\nBlank Issues do not contain the context necessary for a good discussions.`
            });

            // Close the issue
            await client.issues.update({
                owner: issue.owner,
                repo: issue.repo,
                issue_number: issue.number,
                state: "closed"
            });
        } else {
            console.log("Pass!");
        }
    } catch (e) {
        console.log(e);
    }

})();
