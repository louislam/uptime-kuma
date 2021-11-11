const path = require("path");
const Bree = require("bree");
const { SHARE_ENV } = require("worker_threads");
const { log } = require("../src/util");

const jobs = [
    {
        name: "clear-old-data",
        interval: "at 03:14",
    },
];

const initBackgroundJobs = function (args) {
    const bree = new Bree({
        root: path.resolve("server", "jobs"),
        jobs,
        worker: {
            env: SHARE_ENV,
            workerData: args,
        },
        workerMessageHandler: (message) => {
            log("jobs", message);
        }
    });

    bree.start();
    return bree;
};

module.exports = {
    initBackgroundJobs
};
