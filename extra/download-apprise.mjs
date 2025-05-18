// Go to http://ftp.debian.org/debian/pool/main/a/apprise/ using fetch api, where it is a apache directory listing page
// Use cheerio to parse the html and get the latest version of Apprise
// call curl to download the latest version of Apprise
// Target file: the latest version of Apprise, which the format is apprise_{VERSION}_all.deb

import * as cheerio from "cheerio";
import semver from "semver";
import * as childProcess from "child_process";

const baseURL = "http://ftp.debian.org/debian/pool/main/a/apprise/";
const response = await fetch(baseURL);

if (!response.ok) {
    throw new Error("Failed to fetch page of Apprise Debian repository.");
}

const html = await response.text();

const $ = cheerio.load(html);

// Get all the links in the page
const linkElements = $("a");

// Filter the links which match apprise_{VERSION}_all.deb
const links = [];
const pattern = /apprise_(.*?)_all.deb/;

for (let i = 0; i < linkElements.length; i++) {
    const link = linkElements[i];
    if (link.attribs.href.match(pattern) && !link.attribs.href.includes("~")) {
        links.push({
            filename: link.attribs.href,
            version: link.attribs.href.match(pattern)[1],
        });
    }
}

console.log(links);

// semver compare and download
let latestLink = {
    filename: "",
    version: "0.0.0",
};

for (const link of links) {
    if (semver.gt(link.version, latestLink.version)) {
        latestLink = link;
    }
}

const downloadURL = baseURL + latestLink.filename;
console.log(`Downloading ${downloadURL}...`);
let result = childProcess.spawnSync("curl", [ downloadURL, "--output", "apprise.deb" ]);
console.log(result.stdout?.toString());
console.error(result.stderr?.toString());
process.exit(result.status !== null ? result.status : 1);
