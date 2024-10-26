// Go to http://ftp.debian.org/debian/pool/main/a/apprise/ using fetch api, where it is a apache directory listing page
// Use cheerio to parse the html and get the latest version of Apprise
// call curl to download the latest version of Apprise
// Target file: the latest version of Apprise, which the format is apprise_{VERSION}_all.deb

import * as cheerio from "cheerio";

const response = await fetch("http://ftp.debian.org/debian/pool/main/a/apprise/");

if (!response.ok) {
    throw new Error("Failed to fetch page of Apprise Debian repository.");
}

const html = await response.text();

const $ = cheerio.load(html);

// Get all the links in the page
const linkElements = $("a");

// Filter the links which match apprise_{VERSION}_all.deb
const links = [];

for (let i = 0; i < linkElements.length; i++) {
    const link = linkElements[i];
    if (link.attribs.href.match(/apprise_(.*?)_all.deb/) && !link.attribs.href.includes("~")) {
        links.push(link.attribs.href);
    }
}

console.log(links);
// TODO: semver compare and download?
