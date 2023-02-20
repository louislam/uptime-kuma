const args = require("args-parser")(process.argv);
const demoMode = args["demo"] || false;

const badgeConstants = {
    naColor: "#999",
    defaultUpColor: "#66c20a",
    defaultWarnColor: "#eed202",
    defaultDownColor: "#c2290a",
    defaultPendingColor: "#f8a306",
    defaultMaintenanceColor: "#1747f5",
    defaultPingColor: "blue",  // as defined by badge-maker / shields.io
    defaultStyle: "flat",
    defaultPingValueSuffix: "ms",
    defaultPingLabelSuffix: "h",
    defaultUptimeValueSuffix: "%",
    defaultUptimeLabelSuffix: "h",
    defaultCertExpValueSuffix: " days",
    defaultCertExpLabelSuffix: "h",
    // Values Come From Default Notification Times
    defaultCertExpireWarnDays: "14",
    defaultCertExpireDownDays: "7"
};

module.exports = {
    args,
    demoMode,
    badgeConstants,
};
