import net from "node:net";
import { test } from "node:test";
import assert from "node:assert";
// @ts-ignore
import Database from "../../server/database.js";

test("createAuthDatabase dials the configured hostname", async (t) => {
    const server = net.createServer();

    let connections = 0;
    server.on("connection", (socket) => {
        connections++;
        socket.end();
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.2", resolve));
    const port = server.address().port;

    t.after(() => server.close());

    const dbConfig = {
        type: "mariadb",
        hostname: "127.0.0.2",
        port: port,
        dbName: "kuma",
        username: "probe",
        password: "probe",
    };

    const pool = Database.createAuthDatabase(dbConfig);
    t.after(() => pool.end().catch(() => {}));

    // The listener is not a MySQL server, so the handshake fails either
    // way, the assertion is which address the pool dialed
    await pool.getConnection().then(
        (conn) => conn.destroy(),
        () => {}
    );

    assert.strictEqual(connections, 1);
});
