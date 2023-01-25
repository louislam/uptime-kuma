const fs = require("fs");

let langFiles = fs.readdirSync("src/lang/");
let i18nList = JSON.parse(fs.readFileSync("src/i18n-list.json"));
let missInList = [];
let missInLang = Array.from(Object.keys(i18nList));
let diffs = [];

langFiles.forEach(async (filename) => {
    if (!filename.endsWith(".json")) {
        return;
    }

    let langCode = filename.replace(".json", "");
    if (!i18nList[langCode]) {
        missInList.push(langCode);
    } else {
        missInLang.splice(missInLang.indexOf(langCode));

        let lang = JSON.parse(fs.readFileSync(`src/lang/${filename}`));
        if (lang["languageName"] !== i18nList[langCode]["languageName"]) {
            diffs.push(langCode);
        }
    }
});

let err = "";
if (missInLang.length !== 0) {
    err = `Following language is missed in src/lang/:\n${missInLang.join(",\t")}`;
}

if (missInList.length !== 0) {
    err = err + `\nFollowing language is missed in src/i18n-list.json:\n${missInList.join(",\t")}`;
}

if (diffs.length !== 0) {
    err = err + `\nFollowing language have different name between src/lang/ and src/i18n-list.json:\n${diffs.join(",\t")}`;
}

if (err !== "") {
    throw err;
}
