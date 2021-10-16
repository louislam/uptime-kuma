const args = require("args-parser")(process.argv);
const demoMode = args["demo"] || false;

module.exports = {
    args,
    demoMode
};
