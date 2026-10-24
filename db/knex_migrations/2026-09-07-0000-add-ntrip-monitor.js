/**
 * Columns added by this migration, in order.
 *
 * Held as data rather than as builder calls so the same list drives the guarded
 * add, the guarded drop, and the check for what is already present. Deadlines
 * are stored in seconds and normalized to milliseconds by server/ntrip/config.js.
 */
const NTRIP_COLUMNS = [
    { name: "ntrip_tls", type: "boolean", notNullable: true, defaultTo: false },
    { name: "ntrip_mountpoint", type: "string", length: 255 },
    { name: "ntrip_revision", type: "string", length: 10 },
    { name: "ntrip_username", type: "string", length: 255 },
    { name: "ntrip_password", type: "text" },

    { name: "ntrip_handshake_timeout", type: "integer", notNullable: true, defaultTo: 15 },
    { name: "ntrip_initial_timeout", type: "integer", notNullable: true, defaultTo: 30 },
    { name: "ntrip_stale_timeout", type: "integer", notNullable: true, defaultTo: 30 },

    { name: "ntrip_gga_enabled", type: "boolean", notNullable: true, defaultTo: false },
    { name: "ntrip_latitude", type: "decimal", precision: 10, scale: 7 },
    { name: "ntrip_longitude", type: "decimal", precision: 10, scale: 7 },
    { name: "ntrip_altitude_msl", type: "decimal", precision: 12, scale: 3 },
    { name: "ntrip_gga_interval", type: "integer", notNullable: true, defaultTo: 10 },
];

/**
 * Add one column to a table builder from its specification.
 * @param {import("knex").Knex.AlterTableBuilder} table Table builder
 * @param {object} column One entry of NTRIP_COLUMNS
 * @returns {void}
 * @throws {Error} When the specification names a type this migration cannot build
 */
function addColumn(table, column) {
    let builder;

    switch (column.type) {
        case "boolean":
            builder = table.boolean(column.name);
            break;
        case "integer":
            builder = table.integer(column.name);
            break;
        case "string":
            builder = table.string(column.name, column.length);
            break;
        case "text":
            builder = table.text(column.name);
            break;
        case "decimal":
            builder = table.decimal(column.name, column.precision, column.scale);
            break;
        default:
            throw new Error(`Unsupported NTRIP column type: ${column.type}`);
    }

    if (column.notNullable) {
        builder.notNullable();
    }

    builder.defaultTo(column.defaultTo ?? null);
}

/**
 * Split the columns by whether the monitor table already has them.
 *
 * A migration that fails partway leaves some columns present while the
 * migration itself stays unrecorded, so the retry must add only what is
 * missing. Without this guard the retry fails on the first column that already
 * exists and the only recovery is editing the database by hand.
 * @param {import("knex").Knex} knex Knex instance
 * @returns {Promise<{present: Array<object>, missing: Array<object>}>} The two groups
 */
async function partitionColumns(knex) {
    const present = [];
    const missing = [];

    for (const column of NTRIP_COLUMNS) {
        if (await knex.schema.hasColumn("monitor", column.name)) {
            present.push(column);
        } else {
            missing.push(column);
        }
    }

    return { present, missing };
}

exports.up = async function (knex) {
    const { missing } = await partitionColumns(knex);

    if (missing.length === 0) {
        return;
    }

    await knex.schema.alterTable("monitor", function (table) {
        for (const column of missing) {
            addColumn(table, column);
        }
    });
};

exports.down = async function (knex) {
    const { present } = await partitionColumns(knex);

    if (present.length === 0) {
        return;
    }

    await knex.schema.alterTable("monitor", function (table) {
        for (const column of present) {
            table.dropColumn(column.name);
        }
    });
};
