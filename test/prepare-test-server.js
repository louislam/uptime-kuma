const fs = require("fs");

const path = "./data/test";

if (fs.existsSync(path)) {
    fs.rmSync(path, {
        recursive: true,
        force: true,
    });
}
