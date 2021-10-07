const findInFiles = require("find-in-files");
const _ = require("lodash");
const fs = require("fs/promises");
const JSON5 = require("json5");

// Extract translations from $t() functions in the source code and add the missing translations to all language files in src/languages/*.js
async function extractTranslations() {
    // Load all es6 module translation files into a commonJS process
    const languageList = {};
    const filesNames = await fs.readdir("src/languages");
    for (let fileName of filesNames) {
        if (fileName.endsWith("js") && fileName !== "index.js") {
            const content = (await fs.readFile("src/languages/" + fileName)).toString("utf-8");
            const json = content.replace("export default {", "{").replace("};", "}");
            languageList[fileName.split(".")[0]] = JSON5.parse(json);
        }
    }

    const en = languageList.en;

    // Search the source code for usages of $t()
    const results = await findInFiles.find({
        term: "\\$t\\(([^)]+?)\\)",
        flags: "g",
    }, "./src", "\\.(vue|js)");

    const englishExtracted = [];

    // Make a list of all the found strings
    const warnings = [];
    Object.values(results).map(result => {
        result.matches.map(match => {
            const functionParams = match.substring(3, match.length - 1).trim();
            const firstChar = functionParams[0];
            if (!["\"", "'"].includes(firstChar)) {
                // Variable => cannot extract => output warning
                warnings.push("Cannot extract non string values in " + match);
            } else {
                // Actual string
                const content = _.trim(functionParams.split(firstChar)[1], "\"' ");
                englishExtracted.push(content);
            }
        });
    });

    // Update all languages with the missing strings
    for (let extractedTranslation of englishExtracted) {
        for (let langDict of Object.values(languageList)) {
            if (!Object.keys(langDict).includes(extractedTranslation)) {
                langDict[extractedTranslation] = extractedTranslation;
            }
        }
    }

    // Check for translations in other language files that are not in the English file and output warnings for them
    const englishKeys = Object.keys(en);
    for (let langName of Object.keys(languageList)) {
        if (langName !== "en") {
            const langKeys = Object.keys(languageList[langName]);
            const unusedKeys = _.without(langKeys, ...englishKeys);
            if (unusedKeys.length) {
                warnings.push(`Language file ${langName} contains keys that are not used: ["${unusedKeys.join("\", \"")}"]`);
            }
        }
    }

    for (let langName of Object.keys(languageList)) {
        const translationsString = JSON5.stringify(languageList[langName], {
            quote: "\"",
            space: 4,
        })
            .replace(/"$/m, "\","); // Add comma to the last line
        await fs.writeFile(`./src/languages/${_.kebabCase(langName)}.js`, `export default ${translationsString};\n`);
    }

    if (warnings.length) {
        console.log("Extraction successful with warnings: \n\t" + warnings.join("\n\t"));
    } else {
        console.log("Extraction successful");
    }
}

extractTranslations();
