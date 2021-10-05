const fs = require("fs");

fs.rmdirSync("./data/test-chrome-profile", {
    recursive: true,
});
