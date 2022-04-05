const path = require("path");
const Bree = require("bree");
const { SHARE_ENV } = require("worker_threads");
let bree;
const jobs = [
    {
        name: "clear-old-data",
        interval: "at 03:14",
    },
];

const initBackgroundJobs = function (args) {
    bree = new Bree({
        root: path.resolve("server", "jobs"),
        jobs,
        worker: {
            env: SHARE_ENV,
            workerData: args,
        },
        workerMessageHandler: (message) => {
            console.log("[Background Job]:", message);
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
