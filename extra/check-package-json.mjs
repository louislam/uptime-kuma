import packageJSON from "../package.json" with { type: "json" };

let hasError = false;

for (const dep in packageJSON.dependencies) {
    const semver = packageJSON.dependencies[dep];
    if (semver.startsWith("^")) {
        console.error(`Dependency ${dep} has a caret (^) in its version. Please change it to (~)`);
        hasError = true;
    }
}

if (hasError) {
    process.exit(1);
} else {
    console.log("All dependencies are valid.");
}
