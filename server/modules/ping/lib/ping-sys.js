'use strict';

/**
* LICENSE MIT
* (C) Daniel Zelisko
* http://github.com/danielzzz/node-ping
*
* a simple wrapper for ping
* Now with support of not only english Windows.
*
*/

// Promise implementation
var ping = require('./ping-promise');

// TODO:
// 1. Port round trip time to this callback
// 2. However, it may breaks backward compatability
// 3. Need discussion
/**
 * Callback after probing given host
 * @callback probeCallback
 * @param {boolean} isAlive - Whether target is alive or not
 * @param {Object} error - Null if no error occurs
 */

/**
 * Class::Ping construtor
 * @param {string} addr - Hostname or ip addres
 * @param {probeCallback} cb - Callback
 * @param {PingConfig} config - Configuration for command ping
 */
function probe(addr, cb, config) {
    // Do not reassign function parameter
    var _config = config || {};

    return ping.probe(addr, _config).then(function (res) {
        cb(res.alive, null);
    }).catch(function (err) {
        cb(null, err);
    });
}

exports.probe = probe;
