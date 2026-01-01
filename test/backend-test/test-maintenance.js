const { describe, test } = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");
const { SQL_DATETIME_FORMAT } = require("../../src/util");

dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

/**
 * Tests for maintenance date formatting to ensure compatibility with MariaDB/MySQL.
 * Issue: MariaDB rejects ISO format dates like '2025-12-19T01:04:02.129Z'
 * Fix: Use SQL_DATETIME_FORMAT ('YYYY-MM-DD HH:mm:ss') instead of toISOString()
 */
describe("Maintenance Date Format - MariaDB Compatibility", () => {
    test("SQL_DATETIME_FORMAT constant should match MariaDB format", () => {
        assert.strictEqual(SQL_DATETIME_FORMAT, "YYYY-MM-DD HH:mm:ss");
    });

    test("format() produces SQL-compatible datetime string", () => {
        const current = dayjs.utc("2025-12-19T01:04:02.129Z");
        const sqlFormat = current.utc().format(SQL_DATETIME_FORMAT);

        assert.strictEqual(sqlFormat, "2025-12-19 01:04:02");
    });

    test("SQL format does not contain ISO markers (T, Z)", () => {
        const current = dayjs.utc("2025-12-19T01:04:02.129Z");
        const sqlFormat = current.utc().format(SQL_DATETIME_FORMAT);

        assert.strictEqual(sqlFormat.includes("T"), false, "SQL format should not contain 'T'");
        assert.strictEqual(sqlFormat.includes("Z"), false, "SQL format should not contain 'Z'");
    });

    test("SQL format matches YYYY-MM-DD HH:mm:ss pattern", () => {
        const current = dayjs.utc("2025-12-19T01:04:02.129Z");
        const sqlFormat = current.utc().format(SQL_DATETIME_FORMAT);
        const sqlDateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

        assert.strictEqual(sqlDateTimeRegex.test(sqlFormat), true);
    });

    test("parsing SQL datetime back to dayjs preserves timestamp", () => {
        const originalDate = dayjs.utc("2025-12-19T01:04:02.000Z");
        const sqlFormat = originalDate.utc().format(SQL_DATETIME_FORMAT);
        const parsedDate = dayjs.utc(sqlFormat, SQL_DATETIME_FORMAT);

        assert.strictEqual(parsedDate.unix(), originalDate.unix());
    });

    test("formats midnight timestamp correctly", () => {
        const midnight = dayjs.utc("2025-01-01T00:00:00.000Z");
        const sqlFormat = midnight.utc().format(SQL_DATETIME_FORMAT);

        assert.strictEqual(sqlFormat, "2025-01-01 00:00:00");
    });

    test("formats end of day timestamp correctly", () => {
        const endOfDay = dayjs.utc("2025-12-31T23:59:59.999Z");
        const sqlFormat = endOfDay.utc().format(SQL_DATETIME_FORMAT);

        assert.strictEqual(sqlFormat, "2025-12-31 23:59:59");
    });
});
