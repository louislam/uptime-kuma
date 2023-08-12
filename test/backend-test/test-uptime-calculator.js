const { test } = require("node:test");
const assert = require("node:assert");
const { UptimeCalculator } = require("../../server/uptime-calculator");
const dayjs = require("dayjs");
const { UP, DOWN, PENDING, MAINTENANCE } = require("../../src/util");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

test("Test Uptime Calculator - custom date", (t) => {
    let c1 = new UptimeCalculator();

    // Test custom date
    UptimeCalculator.currentDate = dayjs.utc("2021-01-01T00:00:00.000Z");
    assert.strictEqual(c1.getCurrentDate().unix(), dayjs.utc("2021-01-01T00:00:00.000Z").unix());
});

test("Test update - UP", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");
    let c2 = new UptimeCalculator();
    let date = c2.update(UP);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:46:59").unix());
});

test("Test update - MAINTENANCE", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = c2.update(MAINTENANCE);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test update - DOWN", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = c2.update(DOWN);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test update - PENDING", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = c2.update(PENDING);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test flatStatus", (t) => {
    let c2 = new UptimeCalculator();
    assert.strictEqual(c2.flatStatus(UP), UP);
    assert.strictEqual(c2.flatStatus(MAINTENANCE), UP);
    assert.strictEqual(c2.flatStatus(DOWN), DOWN);
    assert.strictEqual(c2.flatStatus(PENDING), DOWN);
});

test("Test update - getDivisionKey", (t) => {
    let c2 = new UptimeCalculator();
    let divisionKey = c2.getDivisionKey(dayjs.utc("2023-08-12 20:46:00"));
    assert.strictEqual(divisionKey, dayjs.utc("2023-08-12 20:46:00").unix());

    // Edge case 1
    c2 = new UptimeCalculator();
    divisionKey = c2.getDivisionKey(dayjs.utc("2023-08-12 20:46:01"));
    assert.strictEqual(divisionKey, dayjs.utc("2023-08-12 20:46:00").unix());

    // Edge case 2
    c2 = new UptimeCalculator();
    divisionKey = c2.getDivisionKey(dayjs.utc("2023-08-12 20:46:59"));
    assert.strictEqual(divisionKey, dayjs.utc("2023-08-12 20:46:00").unix());
});

test("Test update - getDailyKey", (t) => {
    let c2 = new UptimeCalculator();
    let dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 20:46:00").unix());
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 23:45:30").unix());
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    // Edge case 1
    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 23:59:59").unix());
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    // Edge case 2
    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 00:00:00").unix());
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());
});

test("Test update - lastDailyUptimeData", (t) => {
    let c2 = new UptimeCalculator();
    c2.update(UP);
    assert.strictEqual(c2.lastDailyUptimeData.uptime, 1);
});

test("Test update - get24HourUptime", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

    // No data
    let c2 = new UptimeCalculator();
    let uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 0);

    // 1 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 1);

    // 2 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(UP);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 1);

    // 3 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(UP);
    c2.update(UP);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 1);

    // 1 MAINTENANCE
    c2 = new UptimeCalculator();
    c2.update(MAINTENANCE);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 1);

    // 1 PENDING
    c2 = new UptimeCalculator();
    c2.update(PENDING);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 0);

    // 1 DOWN
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 0);

    // 2 DOWN
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    c2.update(DOWN);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 0);

    // 1 DOWN, 1 UP
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    c2.update(UP);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 0.5);

    // 1 UP, 1 DOWN
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(DOWN);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 0.5);

    // Add 24 hours
    c2 = new UptimeCalculator();
    c2.update(UP);
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 1);
    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(24, "hour");

    // After 24 hours, even if there is no data, the uptime should be still 100%
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 1);

    // Add more 24 hours (48 hours)
    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(24, "hour");

    // After 24 hours, even if there is no data, the uptime should be still 100%
    uptime = c2.get24HourUptime();
    assert.strictEqual(uptime, 1);
});
