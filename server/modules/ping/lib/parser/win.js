'use strict';

var util = require('util');
var base = require('./base');

/**
 * @constructor
 * @param {string} addr - Hostname or ip addres
 * @param {PingConfig} config - Config object in probe()
 */
function WinParser(addr, config) {
    base.call(this, addr, config);
    this._ipv4Regex = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
}

util.inherits(WinParser, base);

/**
 * Process output's header
 * @param {string} line - A line from system ping
 */
WinParser.prototype._processHeader = function (line) {
    // XXX: Expect to find [****] when pinging domain like google.com
    //      Read fixture/win/**/* for the detail
    var isPingNumeric = line.indexOf('[') === -1;

    // Get host and numeric_host
    var tokens = line.split(' ');

    if (isPingNumeric) {
        // For those missing [***], get the first token which match IPV4 regex
        this._response.host = tokens.find(
            function (t) {
                return this._ipv4Regex.test(t);
            },
            this
        );
        this._response.numeric_host = this._response.host;
    } else {
        // For those has [***], anchor with such token
        var numericHost = tokens.find(
            function (t) {
                return t.indexOf('[') !== -1;
            },
            this
        );
        var numericHostIndex = tokens.indexOf(numericHost);
        var match = /\[(.*)\]/.exec(numericHost);

        if (match) {
            // Capture IP inside [] only. refs #71
            this._response.numeric_host = match[1];
        } else {
            // Otherwise, just mark as NA to indicate an error
            this._response.numeric_host = 'NA';
        }
        this._response.host = tokens[numericHostIndex - 1];
    }

    this._changeState(this.STATES.BODY);
};

/**
 * Process ipv6 output's body
 * @param {string} line - A line from system ping
 */
WinParser.prototype._processIPV6Body = function (line) {
    var tokens = line.split(' ');
    var dataFields = tokens.filter(function (token) {
        var isDataField = token.indexOf('=') >= 0 || token.indexOf('<') >= 0;
        return isDataField;
    });

    // refs #65: Support system like french which has an extra space
    dataFields = dataFields.map(function (dataField) {
        var ret = dataField;
        var dataFieldIndex = tokens.indexOf(dataField);
        var nextIndex = dataFieldIndex + 1;

        // Append the missing *ms*
        if (nextIndex < tokens.length) {
            if (tokens[nextIndex] === 'ms') {
                ret += 'ms';
            }
        }

        return ret;
    });

    var expectDataFieldInReplyLine = 1;
    if (dataFields.length >= expectDataFieldInReplyLine) {
        // XXX: Assume time will alaways get keyword ms for all language
        var timeKVP = dataFields.find(function (dataField) {
            return dataField.search(/(ms|мс)/i) >= 0;
        });
        var regExp = /([0-9.]+)/;
        var match = regExp.exec(timeKVP);

        this._times.push(parseFloat(match[1], 10));
    }
};

/**
 * Process ipv4 output's body
 * @param {string} line - A line from system ping
 */
WinParser.prototype._processIPV4Body = function (line) {
    var tokens = line.split(' ');
    var byteTimeTTLFields = tokens.filter(function (token) {
        var isDataField = token.indexOf('=') >= 0 || token.indexOf('<') >= 0;
        return isDataField;
    });

    var expectDataFieldInReplyLine = 3;
    var isReplyLine = byteTimeTTLFields.length >= expectDataFieldInReplyLine;
    if (isReplyLine) {
        var packetSize = this._pingConfig.packetSize;
        var byteField = byteTimeTTLFields.find(function (dataField) {
            var packetSizeToken = util.format('=%d', packetSize);
            var isByteField = dataField.indexOf(packetSizeToken) >= 0;
            return isByteField;
        });

        // XXX: Assume time field will always be next of byte field
        var byteFieldIndex = byteTimeTTLFields.indexOf(byteField);
        var timeFieldIndex = byteFieldIndex + 1;
        var timeKVP = byteTimeTTLFields[timeFieldIndex];

        var regExp = /([0-9.]+)/;
        var match = regExp.exec(timeKVP);

        this._times.push(parseFloat(match[1], 10));
        return true;
    }
    return false;
};

/**
 * Process output's body
 * @param {string} line - A line from system ping
 */
WinParser.prototype._processBody = function (line) {
    var isPingSummaryLineShown = line.slice(-1) === ':';
    if (isPingSummaryLineShown) {
        this._changeState(this.STATES.FOOTER);
        return;
    }

    const ok = this._processIPV4Body(line);

    if (!ok) {
        this._processIPV6Body(line);
    }
};

/**
 * Process output's footer
 * @param {string} line - A line from system ping
 */
WinParser.prototype._processFooter = function (line) {
    var packetLoss = line.match(/([\d.]+)%/);
    if (packetLoss) {
        this._response.packetLoss = parseFloat(packetLoss[1], 10);
    }

    // XXX: Assume there is a keyword ms
    if (line.search(/(ms|мсек)/i) >= 0) {
        // XXX: Assume the ordering is Min Max Avg
        var regExp = /([0-9.]+)/g;
        var m1 = regExp.exec(line);
        var m2 = regExp.exec(line);
        var m3 = regExp.exec(line);

        if (m1 && m2 && m3) {
            this._response.min = parseFloat(m1[1], 10);
            this._response.max = parseFloat(m2[1], 10);
            this._response.avg = parseFloat(m3[1], 10);
            this._changeState(this.STATES.END);
        }
    }
};

module.exports = WinParser;
