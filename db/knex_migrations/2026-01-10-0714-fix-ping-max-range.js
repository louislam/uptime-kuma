/**
 * Database Migration: Fix ping_max/ping_min column range limitation
 *
 * Issue: #6472 - Push monitors fail with ping values >= 1,000,000ms
 * Root Cause: FLOAT columns cannot reliably store large integer values
 * Solution: Change FLOAT to DOUBLE for sufficient precision
 *
 * Affected Tables:
 * - stat_daily: Daily aggregate statistics
 * - stat_hourly: Hourly aggregate statistics
 * - stat_minutely: Minutely aggregate statistics
 *
 * Changed Columns (in each table):
 * - ping_min:  FLOAT -> DOUBLE
 * - ping_max:  FLOAT -> DOUBLE
 *
 * Impact:
 * - No data loss (ALTER TABLE preserves data)
 * - Backward compatible (existing queries work)
 * - Rollback available via down() function
 *
 * Testing:
 * - Tested with ping values up to 10,000,000ms (2.7 hours)
 * - Verified on SQLite and MariaDB
 * - Existing monitors continue to work normally
 * @see https://github.com/louislam/uptime-kuma/issues/6472
 * @param {object} knex Knex instance
 * @returns {Promise<void>}
 */
exports.up = function (knex) {
    // Alter all three statistics tables to use DOUBLE instead of FLOAT
    // This allows storing ping values >= 1,000,000 milliseconds

    return knex.schema
        // Fix stat_daily table
        .alterTable("stat_daily", function (table) {
            table.double("ping_min")
                .notNullable()
                .defaultTo(0)
                .comment("Minimum ping during this period in milliseconds")
                .alter();

            table.double("ping_max")
                .notNullable()
                .defaultTo(0)
                .comment("Maximum ping during this period in milliseconds")
                .alter();
        })

        // Fix stat_hourly table
        .alterTable("stat_hourly", function (table) {
            table.double("ping_min")
                .notNullable()
                .defaultTo(0)
                .comment("Minimum ping during this period in milliseconds")
                .alter();

            table.double("ping_max")
                .notNullable()
                .defaultTo(0)
                .comment("Maximum ping during this period in milliseconds")
                .alter();
        })

        // Fix stat_minutely table
        .alterTable("stat_minutely", function (table) {
            table.double("ping_min")
                .notNullable()
                .defaultTo(0)
                .comment("Minimum ping during this period in milliseconds")
                .alter();

            table.double("ping_max")
                .notNullable()
                .defaultTo(0)
                .comment("Maximum ping during this period in milliseconds")
                .alter();
        });
};

/**
 * Rollback migration - restore FLOAT columns
 *
 * WARNING: If large ping values (>= 1,000,000) exist in database,
 * rolling back will cause data loss or errors.
 *
 * Only use this if migration needs to be reverted before
 * any large ping values were stored.
 * @param {object} knex Knex instance
 * @returns {Promise<void>}
 */
exports.down = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table.float("ping_min")
                .notNullable()
                .defaultTo(0)
                .comment("Minimum ping during this period in milliseconds")
                .alter();

            table.float("ping_max")
                .notNullable()
                .defaultTo(0)
                .comment("Maximum ping during this period in milliseconds")
                .alter();
        })

        .alterTable("stat_hourly", function (table) {
            table.float("ping_min")
                .notNullable()
                .defaultTo(0)
                .comment("Minimum ping during this period in milliseconds")
                .alter();

            table.float("ping_max")
                .notNullable()
                .defaultTo(0)
                .comment("Maximum ping during this period in milliseconds")
                .alter();
        })

        .alterTable("stat_minutely", function (table) {
            table.float("ping_min")
                .notNullable()
                .defaultTo(0)
                .comment("Minimum ping during this period in milliseconds")
                .alter();

            table.float("ping_max")
                .notNullable()
                .defaultTo(0)
                .comment("Maximum ping during this period in milliseconds")
                .alter();
        });
};
