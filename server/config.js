const args = require("args-parser")(process.argv);
const demoMode = args["demo"] || false;

const badgeConstants = {
    naColor: "#999",
    defaultUpColor: "#66c20a",
    defaultDownColor: "#c2290a",
    defaultPingColor: "blue",  // as defined by badge-maker / shields.io
};

module.exports = {
    args,
    demoMode,
    badgeConstants
};
