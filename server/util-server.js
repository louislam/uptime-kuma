const tcpp = require('tcp-ping');
const Ping = require("./ping-lite");

exports.tcping = function (hostname, port) {
    return new Promise((resolve, reject) => {
        tcpp.ping({
            address: hostname,
            port: port,
            attempts: 1,
        }, function(err, data) {

            if (err) {
                reject(err);
            }

            if (data.results.length >= 1 && data.results[0].err) {
                reject(data.results[0].err);
            }

            resolve(Math.round(data.max));
        });
    });
}

exports.ping = function (hostname) {
    return new Promise((resolve, reject) => {
        const ping = new Ping(hostname);

        ping.send(function(err, ms) {
            if (err) {
                reject(err)
            } else if (ms === null) {
                reject(new Error("timeout"))
            } else {
                resolve(Math.round(ms))
            }
        });
    });
}
