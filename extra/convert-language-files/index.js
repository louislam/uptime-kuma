// Need to use ES6 to read language files

import fs from "fs";
import rmSync from "../fs-rmSync.js";

async function convent(langCode) {
    fs.copyFileSync(`../../src/languages/${langCode}.js`, `./languages/${langCode}.js`);
    const lang = (await import(`./languages/${langCode}.js`)).default;
    // console.log(JSON.stringify(lang));
    fs.writeFile(`../../src/lang/${langCode}.json`, JSON.stringify(lang, null, 4), function (err) {
        if (err) {
            throw err;
        }
        console.log(`Convent success for ${langCode}`);
    });
}

if (fs.existsSync("./languages")) {
    rmSync("./languages", { recursive: true });
}
fs.mkdirSync("./languages");

let files = fs.readdirSync("../../src/languages/");
console.log(files);
files.forEach(async (filename) => {
    if (filename !== "README.md") {
        await convent(filename.replace(".js", ""));
    }
});
