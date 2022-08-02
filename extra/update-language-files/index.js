// Need to use ES6 to read language files

import fs from "fs";
import path from "path";
import util from "util";
import rmSync from "../fs-rmSync.js";

// https://stackoverflow.com/questions/13786160/copy-folder-recursively-in-node-js
/**
 * Look ma, it's cp -R.
 * @param {string} src  The path to the thing to copy.
 * @param {string} dest The path to the new copy.
 */
const copyRecursiveSync = function (src, dest) {
    let exists = fs.existsSync(src);
    let stats = exists && fs.statSync(src);
    let isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(function (childItemName) {
            copyRecursiveSync(path.join(src, childItemName),
                path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
};

console.log("Arguments:", process.argv);
const baseLangCode = process.argv[2] || "en";
console.log("Base Lang: " + baseLangCode);
if (fs.existsSync("./languages")) {
    rmSync("./languages", { recursive: true });
}
copyRecursiveSync("../../src/languages", "./languages");

const en = (await import("./languages/en.js")).default;
const baseLang = (await import(`./languages/${baseLangCode}.js`)).default;
const files = fs.readdirSync("./languages");
console.log("Files:", files);

for (const file of files) {
    if (! file.endsWith(".js")) {
        console.log("Skipping " + file);
        continue;
    }

    console.log("Processing " + file);
    const lang = await import("./languages/" + file);

    let obj;

    if (lang.default) {
        obj = lang.default;
    } else {
        console.log("Empty file");
        obj = {
            languageName: "<Your Language name in your language (not in English)>"
        };
    }

    // En first
    for (const key in en) {
        if (! obj[key]) {
            obj[key] = en[key];
        }
    }

    if (baseLang !== en) {
        // Base second
        for (const key in baseLang) {
            if (! obj[key]) {
                obj[key] = key;
            }
        }
    }

    const code = "export default " + util.inspect(obj, {
        depth: null,
    });

    fs.writeFileSync(`../../src/languages/${file}`, code);
}

rmSync("./languages", { recursive: true });
console.log("Done. Fixing formatting by ESLint...");
