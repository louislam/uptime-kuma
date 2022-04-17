const fs = require("fs");
const rmSync = require("../extra/fs-rmSync.js");

const path = "./data/test";

if (fs.existsSync(path)) {
    rmSync(path, {
        recursive: true,
    });
}
