import fs from "fs";
const dir = "./db/knex_migrations";

// Get the file list (ending with .js) from the directory
const files = fs.readdirSync(dir).filter((file) => file !== "README.md");

// They are wrong, but they had been merged, so allowed.
const exceptionList = [
    "2024-08-24-000-add-cache-bust.js",
    "2024-10-1315-rabbitmq-monitor.js",
];

// Correct format: YYYY-MM-DD-HHmm-description.js

for (const file of files) {
    if (exceptionList.includes(file)) {
        continue;
    }

    // Check ending with .js
    if (!file.endsWith(".js")) {
        console.error(`It should end with .js: ${file}`);
        process.exit(1);
    }

    const parts = file.split("-");

    // Should be at least 5 parts
    if (parts.length < 5) {
        console.error(`Invalid format: ${file}`);
        process.exit(1);
    }

    // First part should be a year >= 2024
    const year = parseInt(parts[0], 10);
    if (isNaN(year) || year < 2023) {
        console.error(`Invalid year: ${file}`);
        process.exit(1);
    }

    // Second part should be a month
    const month = parseInt(parts[1], 10);
    if (isNaN(month) || month < 1 || month > 12) {
        console.error(`Invalid month: ${file}`);
        process.exit(1);
    }

    // Third part should be a day
    const day = parseInt(parts[2], 10);
    if (isNaN(day) || day < 1 || day > 31) {
        console.error(`Invalid day: ${file}`);
        process.exit(1);
    }

    // Fourth part should be HHmm
    const time = parts[3];

    // Check length is 4
    if (time.length !== 4) {
        console.error(`Invalid time: ${file}`);
        process.exit(1);
    }

    const hour = parseInt(time.substring(0, 2), 10);
    const minute = parseInt(time.substring(2), 10);
    if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59) {
        console.error(`Invalid time: ${file}`);
        process.exit(1);
    }
}

console.log("All knex filenames are correct.");
