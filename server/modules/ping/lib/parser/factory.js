'use strict';

var util = require('util');

var builderFactory = require('../builder/factory');
var WinParser = require('./win');
var MacParser = require('./mac');
var LinuxParser = require('./linux');
var OpenBSDParser = require('./openbsd');

/**
 * A factory creates a parser for parsing output from system ping
 * @constructor
 */
function factory() {}

/**
 * Create a parser for a given platform
 * @param {string} addr - Hostname or ip addres
 * @param {string} platform - Name of the platform
 * @param {PingConfig} [config] - Config object in probe()
 * @return {object} - Parser
 * @throw if given platform is not supported
 */
factory.createParser = function (addr, platform, config) {
    // Avoid function reassignment
    var _config = config || {};

    if (!builderFactory.isPlatformSupport(platform)) {
        throw new Error(util.format('Platform |%s| is not support', platform));
    }

    var ret = null;
    if (builderFactory.isWindow(platform)) {
        ret = new WinParser(addr, _config);
    } else if (builderFactory.isMacOS(platform)) {
        ret = new MacParser(addr, _config);
    } else if (builderFactory.isLinux(platform)) {
        ret = new LinuxParser(addr, _config);
    } else if (builderFactory.isOpenBSD(platform)) {
        ret = new OpenBSDParser(addr, _config);
    }

    return ret;
};

module.exports = factory;
