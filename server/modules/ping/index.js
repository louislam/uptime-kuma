// Vendored from @louislam/ping 0.4.4-mod.1 (MIT, see LICENSE), a fork of
// https://github.com/danielzzz/node-ping. Changes: only the parts Uptime Kuma uses
// are kept (ping.sys and lib/ping-pcap.js are dropped), and underscore is removed.
var ping = {};

ping.promise = require("./lib/ping-promise");

module.exports = ping;
