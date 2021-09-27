const path = require("path");
const { R } = require("redbean-node");
const Database = require("../database");

const dbPath = path.join(
    process.env.DATA_DIR ||
        require("worker_threads").workerData["data-dir"] ||
        "./data/"
);

Database.init({
    "data-dir": dbPath,
});

(async () => {
    await Database.connect();

    console.log(await R.getAll("PRAGMA journal_mode"));
    console.log(
        await R.getAll("SELECT * from setting WHERE key = 'database_version'")
    );

    process.exit(0);
})();
