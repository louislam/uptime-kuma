const { sync: rimrafSync } = require("rimraf");
const Database = require("../server/database");
const { Settings } = require("../server/settings");

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
        this.dataDir && rimrafSync(this.dataDir);
    }
}

module.exports = TestDB;
