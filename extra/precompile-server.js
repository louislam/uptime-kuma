/**
 * Compile the server's TypeScript to CommonJS so the image can run plain `node`,
 * without the tsx loader. Build-time only; fixes up server/server.js in place.
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const esmEntries = ["server/server.js", "server/util-server.js"];

/**
 * Collect every .ts file below a directory.
 * @param {string} dir Directory to walk
 * @param {string[]} found Collected files
 * @returns {string[]} The collected files
 */
function collectTypeScript(dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules") {
                collectTypeScript(file, found);
            }
        } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
            found.push(file);
        }
    }
    return found;
}

/**
 * Compile all .ts files to CommonJS .js files in place.
 * @returns {Promise<void>}
 */
async function compileTypeScript() {
    const entryPoints = [...collectTypeScript(path.join(root, "server")), ...collectTypeScript(path.join(root, "src"))];

    await esbuild.build({
        entryPoints,
        outbase: root,
        outdir: root,
        format: "cjs",
        platform: "node",
        target: "node26",
        logLevel: "warning",
    });

    console.log(`Precompiled ${entryPoints.length} TypeScript files`);
}

/**
 * Rewrite the remaining ESM entry files as CommonJS, in place.
 * @returns {Promise<void>}
 */
async function compileEsmEntries() {
    for (const relativePath of esmEntries) {
        const file = path.join(root, relativePath);
        const source = fs.readFileSync(file, "utf8");
        const { code } = await esbuild.transform(source, {
            loader: "js",
            format: "cjs",
            target: "node26",
        });
        fs.writeFileSync(file, code);
    }

    console.log(`Converted ${esmEntries.length} ESM entry files to CommonJS`);
}

compileTypeScript()
    .then(compileEsmEntries)
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
