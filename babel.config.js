const config = {};

if (process.env.TEST_FRONTEND) {
    config.presets = [ "@babel/preset-env" ];
}

if (process.env.TEST_BACKEND) {
    config.plugins = [ "babel-plugin-rewire" ];
}

module.exports = config;
