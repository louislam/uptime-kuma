const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const platform = process.argv[2];
const healthcheckPath = "./extra/healthcheck";
const healthcheckArmPath = "./extra/healthcheck-armv7";
const healthcheckGoFile = "./extra/healthcheck.go";

if (!platform) {
    console.error("Error: No platform specified.");
    process.exit(1);
}

function renamePrebuiltHealthcheck() {
    try {
        fs.renameSync(healthcheckArmPath, healthcheckPath);
        console.log("Prebuilt healthcheck for armv7 renamed successfully.");
    } catch (error) {
        console.error("Error renaming prebuilt healthcheck:", error.message);
        process.exit(1);
    }
}

function removeArmHealthcheck() {
    if (fs.existsSync(healthcheckArmPath)) {
        try {
            fs.rmSync(healthcheckArmPath);
            console.log("Old armv7 healthcheck removed.");
        } catch (error) {
            console.error("Error removing armv7 healthcheck:", error.message);
        }
    }
}

function buildHealthcheck() {
    try {
        const output = childProcess.execSync(`go build -x -o ${healthcheckPath} ${healthcheckGoFile}`).toString("utf8");
        console.log("Build output:\n", output);
    } catch (error) {
        console.error("Error during build process:", error.message);
        process.exit(1);
    }
}

if (platform === "linux/arm/v7") {
    console.log("Architecture: armv7");

    if (fs.existsSync(healthcheckArmPath)) {
        renamePrebuiltHealthcheck();
        console.log("Already built in the host, skipping build.");
        process.exit(0);
    } else {
        console.log("Prebuilt healthcheck not found. The build might be slow.");
        console.log("Recommendation: Run `npm run build-healthcheck-armv7` before building.");
    }
} else {
    removeArmHealthcheck();
}

// Build the healthcheck
buildHealthcheck();
