'use strict';

var util = require('util');
const commandExistsSync = require('command-exists').sync;

// Our library
var linuxBuilder = require('./linux');
var macBuilder = require('./mac');
var winBuilder = require('./win');
var obsdBuilder = require('./openbsd');

let linuxPing = null;
let linuxPing6 = null;

/**
 * Get `ping` for Linux
 * @returns {string} As description
 */
function getLinuxPing() {
    if (!linuxPing) {
        if (commandExistsSync('ping')) {
            linuxPing = 'ping';
        } else {
            linuxPing = '/bin/ping';
        }
    }
    return linuxPing;
}

/**
 * Get `ping6` for Linux
 * @returns {string} As description
 */
function getLinuxPing6() {
    if (!linuxPing6) {
        if (commandExistsSync('ping6')) {
            linuxPing6 = 'ping6';
        } else {
            linuxPing6 = '/bin/ping6';
        }
    }
    return linuxPing6;
}

/**
 * A factory creates argument builders for different platform
 * @constructor
 */
function factory() {}

/**
 * Check out linux platform
 */
factory.isLinux = function (p) {
    var platforms = ['aix', 'android', 'linux'];

    return platforms.indexOf(p) >= 0;
};

/**
 * Check out macos platform
 */
factory.isMacOS = function (p) {
    var platforms = ['darwin', 'freebsd'];

    return platforms.indexOf(p) >= 0;
};

/**
 * Check out openbsd platform
 */
factory.isOpenBSD = function (p) {
    var platforms = ['openbsd'];

    return platforms.indexOf(p) >= 0;
};

/**
 * Check out window platform
 */
factory.isWindow = function (p) {
    return p && p.match(/^win/) !== null;
};

/**
 * Check whether given platform is supported
 * @param {string} p - Name of the platform
 * @return {bool} - True or False
 */
factory.isPlatformSupport = function (p) {
    return this.isWindow(p) || this.isLinux(p) || this.isMacOS(p) || this.isOpenBSD(p);
};

/**
 * Return a path to the ping executable in the system
 * @param {string} platform - Name of the platform
 * @param {bool} v6 - Ping via ipv6 or not
 * @return {string} - Executable path for system command ping
 * @throw if given platform is not supported
 */
factory.getExecutablePath = function (platform, v6) {
    if (!this.isPlatformSupport(platform)) {
        throw new Error(util.format('Platform |%s| is not support', platform));
    }

    var ret = null;

    if (platform === 'aix') {
        ret = '/usr/sbin/ping';
    } else if (factory.isLinux(platform)) {
        ret = v6 ? getLinuxPing6() : getLinuxPing();
    } else if (factory.isWindow(platform)) {
        ret = process.env.SystemRoot + '/system32/ping.exe';
    } else if (factory.isMacOS(platform)) {
        ret = v6 ? '/sbin/ping6' : '/sbin/ping';
    } else if (factory.isOpenBSD(platform)) {
        ret = v6 ? '/sbin/ping6' : '/sbin/ping';
    }

    return ret;
};

/**
 * Create a builder
 * @param {string} platform - Name of the platform
 * @return {object} - Argument builder
 * @throw if given platform is not supported
 */
factory.createBuilder = function (platform) {
    if (!this.isPlatformSupport(platform)) {
        throw new Error(util.format('Platform |%s| is not support', platform));
    }

    var ret = null;

    if (factory.isLinux(platform)) {
        ret = linuxBuilder;
    } else if (factory.isWindow(platform)) {
        ret = winBuilder;
    } else if (factory.isMacOS(platform)) {
        ret = macBuilder;
    } else if (factory.isOpenBSD(platform)) {
        ret = obsdBuilder;
    }

    return ret;
};

module.exports = factory;
