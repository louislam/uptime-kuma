const path = require("path");
const Bree = require("bree");
const { SHARE_ENV } = require("worker_threads");
const { log } = require("../src/util");
let bree;
const jobs = [
    {
        name: "clear-old-data",
        interval: "at 03:14",
    },
];

/**
 * Initialize background jobs
 * @param {Object} args Arguments to pass to workers
 * @returns {Bree}
 */
const initBackgroundJobs = function (args) {
    bree = new Bree({
        root: path.resolve("server", "jobs"),
        jobs,
        worker: {
            env: SHARE_ENV,
            workerData: args,
        },
        workerMessageHandler: (message) => {
            log.info("jobs", message);
        }
    });

    bree.start();
    return bree;
};

const stopBackgroundJobs = function () {
    if (bree) {
        bree.stop();
    }
};

module.exports = {
    initBackgroundJobs,
    stopBackgroundJobs
};
