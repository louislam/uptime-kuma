const { MonitorType } = require("./monitor-type");
const { chromium } = require("playwright-core");
const { UP, log } = require("../../src/util");
const { Settings } = require("../settings");
const commandExistsSync = require("command-exists").sync;
const childProcess = require("child_process");
const path = require("path");
const Database = require("../database");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { RemoteBrowser } = require("../remote-browser");

/**
 * Cached instance of a browser
 * @type {import ("playwright-core").Browser}
 */
let browser = null;

let allowedList = [];
let lastAutoDetectChromeExecutable = null;

if (process.platform === "win32") {
    allowedList.push(process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe");
    allowedList.push(process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe");
    allowedList.push(process.env["ProgramFiles(x86)"] + "\\Google\\Chrome\\Application\\chrome.exe");

    // Allow Chromium too
    allowedList.push(process.env.LOCALAPPDATA + "\\Chromium\\Application\\chrome.exe");
    allowedList.push(process.env.PROGRAMFILES + "\\Chromium\\Application\\chrome.exe");
    allowedList.push(process.env["ProgramFiles(x86)"] + "\\Chromium\\Application\\chrome.exe");

    // Allow MS Edge
    allowedList.push(process.env["ProgramFiles(x86)"] + "\\Microsoft\\Edge\\Application\\msedge.exe");

    // For Loop A to Z
    for (let i = 65; i <= 90; i++) {
        let drive = String.fromCharCode(i);
        allowedList.push(drive + ":\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
        allowedList.push(drive + ":\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe");
    }

} else if (process.platform === "linux") {
    allowedList = [
        "chromium",
        "chromium-browser",
        "google-chrome",

        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/snap/bin/chromium",           // Ubuntu
    ];
} else if (process.platform === "darwin") {
    allowedList = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
}

/**
 * Is the executable path allowed?
 * @param {string} executablePath Path to executable
 * @returns {Promise<boolean>} The executable is allowed?
 */
async function isAllowedChromeExecutable(executablePath) {
    console.log(config.args);
    if (config.args["allow-all-chrome-exec"] || process.env.UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC === "1") {
        return true;
    }

    // Check if the executablePath is in the list of allowed executables
    return allowedList.includes(executablePath);
}

/**
 * Get the current instance of the browser. If there isn't one, create
 * it.
 * @returns {Promise<import ("playwright-core").Browser>} The browser
 */
async function getBrowser() {
    if (browser && browser.isConnected()) {
        return browser;
    } else {
        let executablePath = await Settings.get("chromeExecutable");

        executablePath = await prepareChromeExecutable(executablePath);

        browser = await chromium.launch({
            //headless: false,
            executablePath,
        });

        return browser;
    }
}

/**
 * Get the current instance of the browser. If there isn't one, create it
 * @param {integer} remoteBrowserID Path to executable
 * @param {integer} userId User ID
 * @returns {Promise<Browser>} The browser
 */
async function getRemoteBrowser(remoteBrowserID, userId) {
    let remoteBrowser = await RemoteBrowser.get(remoteBrowserID, userId);
    log.debug("MONITOR", `Using remote browser: ${remoteBrowser.name} (${remoteBrowser.id})`);
    browser = await chromium.connect(remoteBrowser.url);
    return browser;
}

/**
 * Prepare the chrome executable path
 * @param {string} executablePath Path to chrome executable
 * @returns {Promise<string>} Executable path
 */
async function prepareChromeExecutable(executablePath) {
    // Special code for using the playwright_chromium
    if (typeof executablePath === "string" && executablePath.toLocaleLowerCase() === "#playwright_chromium") {
        // Set to undefined = use playwright_chromium
        executablePath = undefined;
    } else if (!executablePath) {
        if (process.env.UPTIME_KUMA_IS_CONTAINER) {
            executablePath = "/usr/bin/chromium";

            // Install chromium in container via apt install
            if ( !commandExistsSync(executablePath)) {
                await new Promise((resolve, reject) => {
                    log.info("Chromium", "Installing Chromium...");
                    let child = childProcess.exec("apt update && apt --yes --no-install-recommends install chromium fonts-indic fonts-noto fonts-noto-cjk");

                    // On exit
                    child.on("exit", (code) => {
                        log.info("Chromium", "apt install chromium exited with code " + code);

                        if (code === 0) {
                            log.info("Chromium", "Installed Chromium");
                            let version = childProcess.execSync(executablePath + " --version").toString("utf8");
                            log.info("Chromium", "Chromium version: " + version);
                            resolve();
                        } else if (code === 100) {
                            reject(new Error("Installing Chromium, please wait..."));
                        } else {
                            reject(new Error("apt install chromium failed with code " + code));
                        }
                    });
                });
            }

        } else {
            executablePath = findChrome(allowedList);
        }
    } else {
        // User specified a path
        // Check if the executablePath is in the list of allowed
        if (!await isAllowedChromeExecutable(executablePath)) {
            throw new Error("This Chromium executable path is not allowed by default. If you are sure this is safe, please add an environment variable UPTIME_KUMA_ALLOW_ALL_CHROME_EXEC=1 to allow it.");
        }
    }
    return executablePath;
}

/**
 * Find the chrome executable
 * @param {any[]} executables Executables to search through
 * @returns {any} Executable
 * @throws Could not find executable
 */
function findChrome(executables) {
    // Use the last working executable, so we don't have to search for it again
    if (lastAutoDetectChromeExecutable) {
        if (commandExistsSync(lastAutoDetectChromeExecutable)) {
            return lastAutoDetectChromeExecutable;
        }
    }

    for (let executable of executables) {
        if (commandExistsSync(executable)) {
            lastAutoDetectChromeExecutable = executable;
            return executable;
        }
    }
    throw new Error("Chromium not found, please specify Chromium executable path in the settings page.");
}

/**
 * Reset chrome
 * @returns {Promise<void>}
 */
async function resetChrome() {
    if (browser) {
        await browser.close();
        browser = null;
    }
}

/**
 * Test if the chrome executable is valid and return the version
 * @param {string} executablePath Path to executable
 * @returns {Promise<string>} Chrome version
 */
async function testChrome(executablePath) {
    try {
        executablePath = await prepareChromeExecutable(executablePath);

        log.info("Chromium", "Testing Chromium executable: " + executablePath);

        const browser = await chromium.launch({
            executablePath,
        });
        const version = browser.version();
        await browser.close();
        return version;
    } catch (e) {
        throw new Error(e.message);
    }
}
// test remote browser
/**
 * @param {string} remoteBrowserURL Remote Browser URL
 * @returns {Promise<boolean>} Returns if connection worked
 */
async function testRemoteBrowser(remoteBrowserURL) {
    try {
        const browser = await chromium.connect(remoteBrowserURL);
        browser.version();
        await browser.close();
        return true;
    } catch (e) {
        throw new Error(e.message);
    }
}
class RealBrowserMonitorType extends MonitorType {

    name = "real-browser";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        const browser = monitor.remote_browser ? await getRemoteBrowser(monitor.remote_browser, monitor.user_id) : await getBrowser();
        const context = await browser.newContext();
        let page;

        try {
            page = await context.newPage();

            // Prevent Local File Inclusion
            // Accept only http://, https://, and data:// (for testing)
            // https://github.com/louislam/uptime-kuma/security/advisories/GHSA-2qgm-m29m-cj2h
            let url = new URL(monitor.url);
            if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "data:") {
                throw new Error("Invalid url protocol, only http, https and data are allowed.");
            }

            const res = await page.goto(monitor.url, {
                waitUntil: "networkidle",
                timeout: monitor.interval * 1000 * 0.8,
            });

            // Handle data: URLs which don't return a proper Response object
            const isDataUrl = url.protocol === "data:";

            // Normalize keyword early for reuse in checking and status messages
            // This ensures consistent matching and reporting
            let normalizedKeyword = null;

            // Check for keyword if configured
            if (monitor.keyword && monitor.keyword.trim()) {
                // Normalize keyword the same way as page content to ensure consistent matching
                // This prevents false negatives when users accidentally enter extra spaces in keywords
                // For example, "Hello  World" (double space) will match "Hello World" (single space) on page
                normalizedKeyword = monitor.keyword.replace(/\s+/g, " ").trim();

                // Extract all visible text content from the page
                let textContent = await page.textContent("body");

                if (textContent) {
                    // Normalize page content: replace duplicate white spaces with a single space
                    // This handles inconsistent spacing in HTML (tabs, newlines, multiple spaces, etc.)
                    textContent = textContent.replace(/\s+/g, " ").trim();

                    let keywordFound = textContent.includes(normalizedKeyword);
                    const invertKeyword = monitor.invertKeyword === true || monitor.invertKeyword === 1;

                    if (keywordFound === !invertKeyword) {
                        log.debug("monitor", `Keyword check passed. Keyword "${normalizedKeyword}" ${keywordFound ? "found" : "not found"} on page (invert: ${invertKeyword})`);
                    } else {
                        let errorText = textContent;
                        if (errorText.length > 50) {
                            errorText = errorText.substring(0, 47) + "...";
                        }

                        throw new Error(
                            `Keyword check failed. Keyword "${normalizedKeyword}" ${keywordFound ? "found" : "not found"} on page. ` +
                            `Expected: ${invertKeyword ? "not found" : "found"}. Page content: [${errorText}]`
                        );
                    }
                } else {
                    throw new Error("Could not extract text content from page for keyword checking");
                }
            }

            let filename = jwt.sign(monitor.id, server.jwtSecret) + ".png";

            await page.screenshot({
                path: path.join(Database.screenshotDir, filename),
            });

            // Handle data: URLs vs HTTP/HTTPS URLs differently
            if (isDataUrl || (res && res.status() >= 200 && res.status() < 400)) {
                heartbeat.status = UP;
                let statusMsg = isDataUrl ? "200" : res.status().toString();

                // Add keyword info to message if keyword checking was performed
                if (normalizedKeyword) {
                    const invertKeyword = monitor.invertKeyword === true || monitor.invertKeyword === 1;
                    statusMsg += `, keyword "${normalizedKeyword}" ${invertKeyword ? "not found" : "found"}`;
                }

                heartbeat.msg = statusMsg;

                if (res && res.request()) {
                    const timing = res.request().timing();
                    heartbeat.ping = timing.responseEnd;
                } else {
                    heartbeat.ping = 1; // Fallback timing
                }
            } else {
                throw new Error(res ? res.status() + "" : "Network error");
            }
        } finally {
            // Always close page and context, even if there was an error
            // Close page first for proper cleanup order
            if (page) {
                await page.close();
            }
            if (context) {
                await context.close();
            }
        }
    }
}

module.exports = {
    RealBrowserMonitorType,
    testChrome,
    resetChrome,
    testRemoteBrowser,
};
