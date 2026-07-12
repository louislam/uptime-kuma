const { sync: rimrafSync } = require("rimraf");
const Database = require("../server/database");
const { Settings } = require("../server/settings");
const { sleep } = require("../src/util");

class TestDB {
    dataDir;

    constructor(dir = "./data/test") {
        this.dataDir = dir;
    }

    async create() {
        Database.initDataDir({ "data-dir": this.dataDir });
        Database.dbConfig = {
            type: "sqlite",
        };
        Database.writeDBConfig(Database.dbConfig);
        await Database.connect(true);
        await Database.patch();
    }

    async destroy() {
        await Database.close();
        Settings.stopCacheCleaner();
        if (this.dataDir) {
            // Windows may hold file lock?
            await sleep(3000);
            rimrafSync(this.dataDir);
        }
    }
}

module.exports = TestDB;
