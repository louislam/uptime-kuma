const fs = require("fs");

fs.rmSync("./data/playwright-test", {
    recursive: true,
    force: true,
});
