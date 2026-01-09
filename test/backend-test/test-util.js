const { describe, test } = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");

const { SQL_DATETIME_FORMAT } = require("../../src/util");

dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

describe("Server Utilities", () => {
    test("SQL_DATETIME_FORMAT constant matches MariaDB/MySQL format", () => {
        assert.strictEqual(SQL_DATETIME_FORMAT, "YYYY-MM-DD HH:mm:ss");
    });

    test("SQL_DATETIME_FORMAT produces valid SQL datetime string", () => {
        const current = dayjs.utc("2025-12-19T01:04:02.129Z");
        const sqlFormat = current.utc().format(SQL_DATETIME_FORMAT);

        assert.strictEqual(sqlFormat, "2025-12-19 01:04:02");

        // Verify it can be parsed back
        const parsedDate = dayjs.utc(sqlFormat, SQL_DATETIME_FORMAT);
        assert.strictEqual(parsedDate.unix(), current.unix());
    });
});
