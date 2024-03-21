const { Settings } = require("../settings");
const cheerio = require("cheerio");
const jsesc = require("jsesc");
const { log } = require("../../src/util");

const injectDefaultAppearance = (req, res, next) => {

    try {
        // Intercept send() calls and inject Default Appearance
        // https://stackoverflow.com/a/60817116
        const oldSend = res.send;
        res.send = async (data) => {

            if (typeof data === "string") {
                log.debug("inject-default-appearance", req.method + " " + req.url);
                const $ = cheerio.load(data);

                const defaultAppearance = await Settings.get("defaultAppearance");
                if (defaultAppearance) {
                    const head = $("head");

                    const escapedJSONObject = jsesc(defaultAppearance, { isScriptContext: true });

                    const script = $(`
                        <script id="default-appearance" data-json="{}">
                            window.defaultAppearance = ${escapedJSONObject};
                        </script>
                    `);

                    head.append(script);

                    data = $.root().html();
                }
            }

            res.send = oldSend; // set function back to avoid 'double-send'
            return res.send(data);
        };

        next();
    } catch (e) {

        next(e);
    }

};

module.exports = {
    injectDefaultAppearance
};
