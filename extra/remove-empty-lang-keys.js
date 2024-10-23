// For #5231

const fs = require("fs");

let path = "../src/lang";

// list directories in the lang directory
let jsonFileList = fs.readdirSync(path);

for (let jsonFile of jsonFileList) {
    if (!jsonFile.endsWith(".json")) {
        continue;
    }

    let jsonPath = path + "/" + jsonFile;
    let langData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    for (let key in langData) {
        if (langData[key] === "") {
            delete langData[key];
        }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(langData, null, 4) + "\n");
}
