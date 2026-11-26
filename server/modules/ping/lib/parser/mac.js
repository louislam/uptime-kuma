'use strict';

var util = require('util');
var base = require('./base');
var getFloatOrUnknown = require('../utils').getFloatOrUnknown;

/**
 * @constructor
 * @param {string} addr - Hostname or ip addres
 * @param {PingConfig} config - Config object in probe()
 */
function MacParser(addr, config) {
    base.call(this, addr, config);
}

util.inherits(MacParser, base);

/**
 * Check whether a reply comes from the target address
 * @param {string} line - A line from system ping
 * @param {string} numericHost - Target IP address
 * @returns {boolean} Whether the reply address matches the target
 */
function isReplyFromTarget(line, numericHost) {
    return line.includes(` ${numericHost}: `) || line.includes(` (${numericHost}): `);
}

/**
 * Process output's header
 * @param {string} line - A line from system ping
 */
MacParser.prototype._processHeader = function (line) {
    // Get host and numeric_host
    var tokens = line.split(' ');

    this._response.host = tokens[1];
    this._response.numeric_host = tokens[2].slice(1, -2);

    this._changeState(this.STATES.BODY);
};

/**
 * Process output's body
 * @param {string} line - A line from system ping
 */
MacParser.prototype._processBody = function (line) {
    // XXX: Assume there is at least 3 '=' can be found
    var count = (line.match(/=/g) || []).length;
    if (count >= 3) {
        var regExp = /([0-9.]+)[ ]*ms/;
        var match = regExp.exec(line);

        // XXX: This option is only provided in linux builder, but the parser is shared.
        // This option should have no effect on macOS,
        // as ping on macOS does not accept replies from a different address
        if (!this._pingConfig.ignoreDifferentAddressReply ||
            isReplyFromTarget(line, this._response.numeric_host)) {
            this._times.push(getFloatOrUnknown(match[1]));
        }
    }

    // Change state if it see a '---'
    if (line.indexOf('---') >= 0) {
        this._changeState(this.STATES.FOOTER);
    }
};

/**
 * Process output's footer
 * @param {string} line - A line from system ping
 */
MacParser.prototype._processFooter = function (line) {
    // The footer includes ignored replies, so its statistics are invalid when none were accepted.
    if (this._pingConfig.ignoreDifferentAddressReply && this._times.length === 0) {
        this._response.packetLoss = 100;
        this._changeState(this.STATES.END);
        return;
    }

    var packetLoss = line.match(/ ([\d.]+)%/);
    if (packetLoss) {
        this._response.packetLoss = getFloatOrUnknown(packetLoss[1]);
    }

    // XXX: Assume number of keywords '/' more than 3
    var count = (line.match(/[/]/g) || []).length;
    if (count >= 3) {
        var regExp = /(([0-9.]+)|nan)/g;
        // XXX: Assume min avg max stddev
        var m1 = regExp.exec(line);
        var m2 = regExp.exec(line);
        var m3 = regExp.exec(line);
        var m4 = regExp.exec(line);

        if (m1 && m2 && m3 && m4) {
            this._response.min = getFloatOrUnknown(m1[1]);
            this._response.avg = getFloatOrUnknown(m2[1]);
            this._response.max = getFloatOrUnknown(m3[1]);
            this._response.stddev = getFloatOrUnknown(m4[1]);
            this._changeState(this.STATES.END);
        }

        this._changeState(this.STATES.END);
    }
};

module.exports = MacParser;
