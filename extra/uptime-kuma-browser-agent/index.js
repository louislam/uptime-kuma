//PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD

import express from "express";
import argsParser from "args-parser";
import pino from "pino";

const logger = pino({
    transport: {
        target: "pino-pretty"
    },
});
logger.info("Starting Uptime Kuma Browser Agent");

const args = argsParser(process.argv);

const app = express();
app.use(express.json());

const port = [ args.port, process.env.UKBA_PORT, 3002 ]
    .map(portValue => parseInt(portValue))
    .find(portValue => !isNaN(portValue));

const password = args.password || process.env.UKBA_PASSWORD || "";

let defaultHostname = null;

if (password === "") {
    defaultHostname = "localhost";
}

const hostname = args.host || process.env.UKBA_HOST || defaultHostname;

if (password === "" && hostname === "localhost") {
    logger.warn("No password set, this agent can only be accessed from localhost");
    logger.warn("Set a password using the UKBA_PASSWORD environment variable or the --password command line argument");
}

app.get("/", function (req, res) {
    // Get password from query string
    const queryPassword = req.query.password;

    if (password !== "" && queryPassword !== password) {
        res.status(401).json({
            error: "Unauthorized",
        });
        return;
    }

    res.json({
        message: "Hello World",
    });
});

app.listen(port);
logger.info(`Listening on ${hostname}:${port}`);

