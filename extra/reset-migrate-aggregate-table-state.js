const { getKnex } = require("../server/db");
const Database = require("../server/database");
const args = require("args-parser")(process.argv);
const { Settings } = require("../server/settings");

const main = async () => {
    console.log("Connecting the database");
    Database.initDataDir(args);
    await Database.connect(false, false, true);

    const knex = getKnex();
    console.log("Deleting all data from aggregate tables");
    await knex("stat_minutely").delete();
    await knex("stat_hourly").delete();
    await knex("stat_daily").delete();

    console.log("Resetting the aggregate table state");
    await Settings.set("migrateAggregateTableState", "");

    await Database.close();
    console.log("Done");
};

main();
