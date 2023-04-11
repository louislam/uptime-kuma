const fs = require("fs");

// Read the file from private/sort-contributors.txt
const file = fs.readFileSync("private/sort-contributors.txt", "utf8");

// Convert to an array of lines
let lines = file.split("\n");

// Remove empty lines
lines = lines.filter((line) => line !== "");

// Remove duplicates
lines = [ ...new Set(lines) ];

// Remove @weblate and @UptimeKumaBot
lines = lines.filter((line) => line !== "@weblate" && line !== "@UptimeKumaBot" && line !== "@louislam");

// Sort the lines
lines = lines.sort();

// Output the lines, concat with " "
console.log(lines.join(" "));
