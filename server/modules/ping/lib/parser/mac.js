'use strict';

var util = require('util');
var base = require('./base');

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
        this._times.push(parseFloat(match[1], 10));
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
    var packetLoss = line.match(/ ([\d.]+)%/);
    if (packetLoss) {
        this._response.packetLoss = parseFloat(packetLoss[1], 10);
    }

    // XXX: Assume number of keywords '/' more than 3
    var count = (line.match(/[/]/g) || []).length;
    if (count >= 3) {
        var regExp = /([0-9.]+)/g;
        // XXX: Assume min avg max stddev
        var m1 = regExp.exec(line);
        var m2 = regExp.exec(line);
        var m3 = regExp.exec(line);
        var m4 = regExp.exec(line);

        if (m1 && m2 && m3 && m4) {
            this._response.min = parseFloat(m1[1], 10);
            this._response.avg = parseFloat(m2[1], 10);
            this._response.max = parseFloat(m3[1], 10);
            this._response.stddev = parseFloat(m4[1], 10);
            this._changeState(this.STATES.END);
        }

        this._changeState(this.STATES.END);
    }
};

module.exports = MacParser;
