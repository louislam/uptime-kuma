const config = {};

if (process.env.TEST_FRONTEND) {
    config.presets = [ "@babel/preset-env" ];
}

module.exports = config;
