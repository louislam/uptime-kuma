const tcpp = require('tcp-ping');
const Ping = require("./ping-lite");
const {R} = require("redbean-node");

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

exports.setSetting = async function (key, value) {
    let bean = await R.findOne("setting", " `key` = ? ", [
        key
    ])
    if (! bean) {
        bean = R.dispense("setting")
        bean.key = key;
    }
    bean.value = value;
    await R.store(bean)
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


// ssl-checker by @dyaa
// param: res - response object from axios
// return an object containing the certificate information

const getDaysBetween = (validFrom, validTo) =>
    Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);

const getDaysRemaining = (validFrom, validTo) => {
    const daysRemaining = getDaysBetween(validFrom, validTo);
    if (new Date(validTo).getTime() < new Date().getTime()) {
        return -daysRemaining;
    }
    return daysRemaining;
};

exports.checkCertificate = function (res) {
    const {
        valid_from,
        valid_to,
        subjectaltname,
        issuer,
        fingerprint,
    } = res.request.res.socket.getPeerCertificate(false);

    if (!valid_from || !valid_to || !subjectaltname) {
        reject(new Error('No certificate'));
        return;
    }

    const valid = res.request.res.socket.authorized || false;

    const validTo = new Date(valid_to);

    const validFor = subjectaltname
        .replace(/DNS:|IP Address:/g, "")
        .split(", ");

    const daysRemaining = getDaysRemaining(new Date(), validTo);

    return {
        valid,
        validFor,
        validTo,
        daysRemaining,
        issuer,
        fingerprint,
    };
}