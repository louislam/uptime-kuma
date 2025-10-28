// Need to use ES6 to read language files

import fs from "fs";
import util from "util";

/**
 * Copy across the required language files
 * Creates a local directory (./languages) and copies the required files
 * into it.
 * @param {string} langCode Code of language to update. A file will be
 * created with this code if one does not already exist
 * @param {string} baseLang The second base language file to copy. This
 * will be ignored if set to "en" as en.js is copied by default
 * @returns {void}
 */
function copyFiles(langCode, baseLang) {
    if (fs.existsSync("./languages")) {
        fs.rmSync("./languages", {
            recursive: true,
            force: true,
        });
    }
    fs.mkdirSync("./languages");

    if (!fs.existsSync(`../../src/languages/${langCode}.js`)) {
        fs.closeSync(fs.openSync(`./languages/${langCode}.js`, "a"));
    } else {
        fs.copyFileSync(`../../src/languages/${langCode}.js`, `./languages/${langCode}.js`);
    }
    fs.copyFileSync("../../src/languages/en.js", "./languages/en.js");
    if (baseLang !== "en") {
        fs.copyFileSync(`../../src/languages/${baseLang}.js`, `./languages/${baseLang}.js`);
    }
}

/**
 * Update the specified language file
 * @param {string} langCode Language code to update
 * @param {string} baseLangCode Second language to copy keys from
 * @returns {void}
 */
async function updateLanguage(langCode, baseLangCode) {
    const en = (await import("./languages/en.js")).default;
    const baseLang = (await import(`./languages/${baseLangCode}.js`)).default;

    let file = langCode + ".js";
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

// Get command line arguments
const baseLangCode = process.env.npm_config_baselang || "en";
const langCode = process.env.npm_config_language;

// We need the file to edit
if (langCode == null) {
    throw new Error("Argument --language=<code> must be provided");
}

console.log("Base Lang: " + baseLangCode);
console.log("Updating: " + langCode);

copyFiles(langCode, baseLangCode);
await updateLanguage(langCode, baseLangCode);
fs.rmSync("./languages", {
    recursive: true,
    force: true,
});

console.log("Done. Fixing formatting by ESLint...");
