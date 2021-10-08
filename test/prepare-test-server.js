const fs = require("fs");

const path = "./data/test";

if (fs.existsSync(path)) {
    fs.rmdirSync(path, {
        recursive: true,
    });
}
