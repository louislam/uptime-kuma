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

// System library
var util = require('util');
var net = require('net');
var cp = require('child_process');
var os = require('os');

// Our library
var builderFactory = require('./builder/factory');
var parserFactory = require('./parser/factory');

/**
 * Refer to probe()
 */
function _probe(addr, config) {
    // Do not reassign function argument
    var _config = config || {};
    if (_config.v6 === undefined) {
        _config.v6 = net.isIPv6(addr);
    }

    // Convert callback base system command to promise base
    return new Promise(function (resolve, reject) {
        // Spawn a ping process
        var ping = null;
        var platform = os.platform();
        try {
            var argumentBuilder = builderFactory.createBuilder(platform);
            var pingExecutablePath = builderFactory.getExecutablePath(platform, _config.v6);
            var pingArgs = argumentBuilder.getCommandArguments(addr, _config);
            var spawnOptions = argumentBuilder.getSpawnOptions();
            ping = cp.spawn(pingExecutablePath, pingArgs, spawnOptions);
        } catch (err) {
            reject(err);
            return;
        }

        // Initial parser
        var parser = parserFactory.createParser(addr, platform, _config);

        // Register events from system ping
        ping.once('error', function () {
            var err = new Error(
                util.format(
                    'ping.probe: %s. %s',
                    'there was an error while executing the ping program. ',
                    'Check the path or permissions...'
                )
            );
            reject(err);
        });

        // Cache all lines from the system ping
        var outstring = [];
        ping.stdout.on('data', function (data) {
            outstring.push(String(data));
        });
        ping.stderr.on('data', function (data) {
            outstring.push(String(data));
        });

        // Parse lines we have on closing system ping
        ping.once('close', function () {
            // Merge lines we have and split it by \n
            var lines = outstring.join('').split('\n');

            // Parse line one by one
            lines.forEach(parser.eat, parser);

            // Get result
            var ret = parser.getResult();

            resolve(ret);
        });
    });
}

/**
 * Class::PromisePing
 * @param {string} addr - Hostname or ip addres
 * @param {PingConfig} config - Configuration for command ping
 * @return {Promise}
 */
function probe(addr, config) {
    try {
        var probePromise = _probe(addr, config);
        return probePromise;
    } catch (error) {
        var errorPromise = Promise.reject(error);
        return errorPromise;
    }
}

exports.probe = probe;
