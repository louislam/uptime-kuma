const tcpp = require('tcp-ping');
const Ping = require("./ping-lite");
const {R} = require("redbean-node");
const dns = require('dns');

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

exports.setting = async function (key) {
    return await R.getCell("SELECT `value` FROM setting WHERE `key` = ? ", [
        key
    ])
}

exports.getSettings = async function (type) {
    let list = await R.getAll("SELECT * FROM setting WHERE `type` = ? ", [
        type
    ])

    let result = {};

    for (let row of list) {
        result[row.key] = row.value;
    }

    return result;
}

// Async function wrapper for dns.lookup()
// Returns list of resolved IP Addresses
exports.dnsLookup = async function (name) {
    return new Promise((resolve, reject) => {
        dns.lookup(name, { all: true, family: 0 }, (err, ips) => {
            if (err) {
                reject(err);
            } else {
                resolve(ips);
            }
        });
    });
};

// check if string is a valid IP address
// is-ipv6-node by @anatoliygatt
exports.isIpAddress = function (ipAddress) {
    // IPv4
    if (
        /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
            ipAddress
        )
    ) {
        return true;
    }
    // IPv6
    if (
        /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/.test(
            ipAddress
        )
    ) {
        return true;
    }
    return false;
};
