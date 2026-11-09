'use strict';

var cp = require('child_process');
var os = require('os');
var iconv = require('iconv-lite');
var chardet = require('chardet');

/**
 * Check if a platform is Windows
 * @param {string} platform - Value of os.platform()
 * @return {boolean} - True for Windows
 */
function isWindows(platform) {
    return !!platform && platform.match(/^win/) !== null;
}

/**
 * Map a Windows codepage number to an iconv-lite encoding name
 * @param {string} id - Numeric codepage, e.g. "936"
 * @return {string} - Encoding name, e.g. "cp936"
 */
function toEncodingName(id) {
    return id === '65001' ? 'utf8' : 'cp' + id;
}

/**
 * Read the Windows OEM (console) codepage as an iconv-lite encoding name
 * @return {string|null} - Codepage name, or null when it cannot be detected
 */
function detectWindowsCodepage() {
    // Registry first, chcp as a fallback; both print the number as plain digits
    var commands = [
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage" /v OEMCP',
        'chcp',
    ];

    for (var i = 0; i < commands.length; i++) {
        try {
            var match = /(\d+)/.exec(cp.execSync(commands[i], { encoding: 'utf8' }));
            if (match) {
                return toEncodingName(match[1]);
            }
        } catch (e) {
            // Try the next command
        }
    }

    return null;
}

// ping.exe writes in the console codepage, so read it once
var windowsCodepage = isWindows(os.platform()) ? detectWindowsCodepage() : null;

/**
 * Get the Windows OEM codepage detected at startup
 * @return {string|null} - Codepage name, or null when it cannot be detected
 */
function getWindowsCodepage() {
    return windowsCodepage;
}

/**
 * Convert system ping output to UTF8
 * @param {Buffer} body - Raw output of the system ping
 * @param {string} platform - Value of os.platform()
 * @param {string} codepage - Optional explicit codepage, otherwise the platform one is used
 * @return {string} - UTF8 string
 */
function convertToUTF8(body, platform, codepage) {
    // Only Windows ping.exe writes in the console codepage
    if (!isWindows(platform)) {
        return body.toString('utf8');
    }

    codepage = codepage || windowsCodepage;
    if (codepage && iconv.encodingExists(codepage)) {
        return iconv.decode(body, codepage);
    }

    return iconv.decode(body, chardet.detect(body)).toString();
}

exports.convertToUTF8 = convertToUTF8;
exports.getWindowsCodepage = getWindowsCodepage;
exports.toEncodingName = toEncodingName;
