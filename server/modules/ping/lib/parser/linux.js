'use strict';

var util = require('util');
var base = require('./base');
var MacParser = require('./mac');

/**
 * @constructor
 * @param {string} addr - Hostname or ip addres
 * @param {PingConfig} config - Config object in probe()
 */
function LinuxParser(addr, config) {
    base.call(this, addr, config);
}

util.inherits(LinuxParser, base);

/**
 * Process output's body
 * @param {string} line - A line from system ping
 */
LinuxParser.prototype._processHeader = function (line) {
    // Get host and numeric_host
    var tokens = line.split(' ');
    var isProbablyIPv4 = tokens[1].indexOf('(') === -1;

    if (isProbablyIPv4) {
        this._response.host = tokens[1];
        this._response.numeric_host = tokens[2].slice(1, -1);
    } else {
        // Normalise into either a 2 or 3 element array
        var foundAddresses = tokens
            .slice(1, -3)
            .join('')
            .match(/([^\s()]+)/g);
        this._response.host = foundAddresses.shift();
        this._response.numeric_host = foundAddresses.pop();
    }

    this._changeState(this.STATES.BODY);
};

/**
 * Process output's body
 * @param {string} line - A line from system ping
 */
LinuxParser.prototype._processBody = function (line) {
    // Reuse mac parser implementation
    MacParser.prototype._processBody.call(this, line);
};

/**
 * Process output's footer
 * @param {string} line - A line from system ping
 */
LinuxParser.prototype._processFooter = function (line) {
    // Reuse mac parser implementation
    MacParser.prototype._processFooter.call(this, line);
};

module.exports = LinuxParser;
