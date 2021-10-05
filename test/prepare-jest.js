const fs = require("fs");

const path = "./data/test-chrome-profile";

if (fs.existsSync(path)) {
    fs.rmdirSync(path, {
        recursive: true,
    });
}
