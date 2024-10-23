// For #5231

const fs = require("fs");

let path = "./src/lang";

// list directories in the lang directory
let jsonFileList = fs.readdirSync(path);

for (let jsonFile of jsonFileList) {
    if (!jsonFile.endsWith(".json")) {
        continue;
    }

    let jsonPath = path + "/" + jsonFile;
    let originalContent = fs.readFileSync(jsonPath, "utf8");
    let langData = JSON.parse(originalContent);

    let formattedContent = JSON.stringify(langData, null, 4) + "\n";

    if (originalContent !== formattedContent) {
        console.error(`File ${jsonFile} is not formatted correctly.`);
        process.exit(1);
    }
}

console.log("All lang json files are formatted correctly.");
