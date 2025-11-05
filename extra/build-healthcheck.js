const childProcess = require("child_process");
const platform = process.argv[2];

if (!platform) {
    console.error("No platform??");
    process.exit(1);
}

const output = childProcess.execSync("go build -x -o ./extra/healthcheck ./extra/healthcheck.go").toString("utf8");
console.log(output);

