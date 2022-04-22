const { parentPort, workerData } = require("worker_threads");
const Database = require("../database");
const path = require("path");

/**
 * Send message to parent process for logging
 * since worker_thread does not have access to stdout, this is used
 * instead of console.log()
 * @param {any} any The message to log
 */
const log = function (any) {
    if (parentPort) {
        parentPort.postMessage(any);
    }
};

/**
 * Exit the worker process
 * @param {number} error The status code to exit
 */
const exit = function (error) {
    if (error && error !== 0) {
        process.exit(error);
    } else {
        if (parentPort) {
            parentPort.postMessage("done");
        } else {
            process.exit(0);
        }
    }
};

/** Connects to the database */
const connectDb = async function () {
    const dbPath = path.join(
        process.env.DATA_DIR || workerData["data-dir"] || "./data/"
    );

    Database.init({
        "data-dir": dbPath,
    });

    await Database.connect();
};

module.exports = {
    log,
    exit,
    connectDb,
};
