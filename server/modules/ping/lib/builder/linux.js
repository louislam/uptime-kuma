'use strict';

/**
 * A builder builds command line arguments for ping in linux environment
 * @module lib/builder/linux
 */
var util = require('util');

var builder = {};

/**
 * Cross platform config representation
 * @typedef {Object} PingConfig
 * @property {boolean} numeric - Map IP address to hostname or not
 * @property {number} timeout - Time to wait for a response, in seconds.
 * The option affects only timeout  in  absence  of any responses,
 * otherwise ping waits for two RTTs.
 * @property {number} deadline - Specify a timeout, in seconds,
 * before ping exits regardless of how many packets have been sent or received.
 * In this case ping does not stop after count packet are sent,
 * it waits either for deadline expire or until count probes are answered
 * or for some error notification from network.
 * This option is only available on linux and mac.
 * @property {number} min_reply - Exit after sending number of ECHO_REQUEST
 * @property {boolean} v6 - Use IPv4 (default) or IPv6
 * @property {string} sourceAddr - source address for sending the ping
 * @property {number} packetSize - Specifies the number of data bytes to be sent
 *                                 Default: Linux / MAC: 56 Bytes,
 *                                          Window: 32 Bytes
 * @property {string[]} extra - Optional options does not provided
 */

var defaultConfig = {
    numeric: true,
    timeout: 2,
    deadline: false,
    min_reply: 1,
    v6: false,
    sourceAddr: '',
    packetSize: 56,
    extra: [],
};

/**
 * Get the finalized array of command line arguments
 * @param {string} target - hostname or ip address
 * @param {PingConfig} [config] - Configuration object for cmd line argument
 * @return {string[]} - Command line argument according to the configuration
 */
builder.getCommandArguments = function (target, config) {
    var _config = config || {};

    // Empty argument
    var ret = [];

    // Make every key in config has been setup properly
    var keys = ['numeric', 'timeout', 'deadline', 'min_reply', 'v6',
        'sourceAddr', 'extra', 'packetSize'];
    keys.forEach(function (k) {
        // Falsy value will be overridden without below checking
        if (typeof(_config[k]) !== 'boolean') {
            _config[k] = _config[k] || defaultConfig[k];
        }
    });

    if (_config.numeric) {
        ret.push('-n');
    }

    if (_config.timeout) {
        ret = ret.concat([
            '-W',
            util.format('%d', _config.timeout),
        ]);
    }

    if (_config.deadline) {
        ret = ret.concat([
            '-w',
            util.format('%d', _config.deadline),
        ]);
    }

    if (_config.min_reply) {
        ret = ret.concat([
            '-c',
            util.format('%d', _config.min_reply),
        ]);
    }

    if (_config.sourceAddr) {
        ret = ret.concat([
            '-I',
            util.format('%s', _config.sourceAddr),
        ]);
    }

    if (_config.packetSize) {
        ret = ret.concat([
            '-s',
            util.format('%d', _config.packetSize),
        ]);
    }

    if (_config.extra) {
        ret = ret.concat(_config.extra);
    }

    ret.push(target);

    return ret;
};

/**
 * Compute an option object for child_process.spawn
 * @return {object} - Refer to document of child_process.spawn
 */
builder.getSpawnOptions = function () {
    return {
        shell: false,
        env: Object.assign(process.env, {LANG: 'C'}),
    };
};

module.exports = builder;
