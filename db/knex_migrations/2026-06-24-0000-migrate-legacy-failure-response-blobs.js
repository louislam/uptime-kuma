const zlib = require("node:zlib");

/**
 * Early iterations of the failure-detail feature stored a JSON wrapper
 * (status, headers, body) in the compressed response column. Split that
 * data into the dedicated response_headers column and a body-only response.
 */
exports.up = async function (knex) {
    const rows = await knex("heartbeat").whereNotNull("response").select("id", "response", "response_headers");

    for (const row of rows) {
        if (row.response_headers) {
            continue;
        }

        let decoded;
        try {
            decoded = zlib.brotliDecompressSync(Buffer.from(row.response, "base64")).toString("utf8");
        } catch {
            continue;
        }

        let parsed;
        try {
            parsed = JSON.parse(decoded);
        } catch {
            continue;
        }

        if (!parsed || typeof parsed !== "object") {
            continue;
        }

        if (!("headers" in parsed || "body" in parsed || "status" in parsed)) {
            continue;
        }

        const updates = {};

        if (parsed.headers && typeof parsed.headers === "object") {
            updates.response_headers = Buffer.from(JSON.stringify(parsed.headers), "utf8").toString("base64");
        }

        if (parsed.body !== undefined) {
            const bodyStr = typeof parsed.body === "string" ? parsed.body : JSON.stringify(parsed.body);
            updates.response = zlib.brotliCompressSync(Buffer.from(bodyStr, "utf8")).toString("base64");
        } else if ("headers" in parsed || "status" in parsed) {
            updates.response = null;
        }

        if (Object.keys(updates).length > 0) {
            await knex("heartbeat").where("id", row.id).update(updates);
        }
    }
};

exports.down = function () {
    // Data migration is not reversible.
};
