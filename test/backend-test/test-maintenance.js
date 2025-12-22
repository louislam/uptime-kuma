const test = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");
const { SQL_DATETIME_FORMAT } = require("../../src/util");
dayjs.extend(require("dayjs/plugin/utc"));

test("Test SQL_DATETIME_FORMAT is compatible with MariaDB/MySQL", async (t) => {
    // The format should be "YYYY-MM-DD HH:mm:ss" which is compatible with MariaDB/MySQL
    assert.strictEqual(SQL_DATETIME_FORMAT, "YYYY-MM-DD HH:mm:ss");
});

test("Test date formatting with SQL_DATETIME_FORMAT instead of toISOString", async (t) => {
    const current = dayjs.utc("2025-12-19T01:04:02.129Z");

    // ISO format (not compatible with MariaDB/MySQL)
    const isoFormat = current.toISOString();
    assert.strictEqual(isoFormat, "2025-12-19T01:04:02.129Z");

    // SQL datetime format (compatible with MariaDB/MySQL)
    const sqlFormat = current.utc().format(SQL_DATETIME_FORMAT);
    assert.strictEqual(sqlFormat, "2025-12-19 01:04:02");

    // Ensure the SQL format doesn't contain 'T' or 'Z' which MariaDB rejects
    assert.ok(!sqlFormat.includes("T"), "SQL format should not contain 'T'");
    assert.ok(!sqlFormat.includes("Z"), "SQL format should not contain 'Z'");

    // Ensure the SQL format matches the expected pattern
    const sqlDateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    assert.ok(sqlDateTimeRegex.test(sqlFormat), "SQL format should match YYYY-MM-DD HH:mm:ss pattern");
});

test("Test parsing SQL datetime back to dayjs", async (t) => {
    const originalDate = dayjs.utc("2025-12-19T01:04:02.000Z");
    const sqlFormat = originalDate.utc().format(SQL_DATETIME_FORMAT);

    // Parse the SQL format back and compare
    const parsedDate = dayjs.utc(sqlFormat, SQL_DATETIME_FORMAT);
    assert.strictEqual(parsedDate.unix(), originalDate.unix());
});
