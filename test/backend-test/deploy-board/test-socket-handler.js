const { describe, test } = require("node:test");
const assert = require("node:assert");
const { deployBoardSocketHandler } = require("../../../server/socket-handlers/deploy-board-socket-handler");
const { broadcastToLoggedIn, UPDATE_EVENT } = require("../../../server/deploy-board/broadcast");
const { DeployBoard } = require("../../../server/deploy-board");

/**
 * Minimal stand-in for a socket.io socket.
 * @param {number|null} userID Logged-in user, or null.
 * @returns {object} Fake socket.
 */
function fakeSocket(userID) {
    const handlers = {};
    return {
        userID,
        emitted: [],
        on(event, fn) {
            handlers[event] = fn;
        },
        emit(event, payload) {
            this.emitted.push({ event, payload });
        },
        /**
         * Simulate the browser emitting an event with a callback.
         * @param {string} event Event name.
         * @returns {Promise<object>} What the server answered.
         */
        call(event) {
            return new Promise((resolve) => handlers[event](resolve));
        },
        /**
         * Simulate the browser emitting an event with an arbitrary argument.
         * @param {string} event Event name.
         * @param {any} arg Argument.
         * @returns {any} Handler return value.
         */
        raw(event, arg) {
            return handlers[event](arg);
        },
    };
}

describe("Socket do painel de deploys", () => {
    const board = new DeployBoard({ env: {} });

    test("socket sem login recebe recusa e nenhum dado do painel", async () => {
        const socket = fakeSocket(null);
        deployBoardSocketHandler(socket, board);
        const answer = await socket.call("getDeployBoard");
        assert.strictEqual(answer.ok, false);
        assert.strictEqual(answer.board, undefined);
        assert.match(answer.msg, /not logged in/);
    });

    test("socket logado recebe o estado inteiro", async () => {
        const socket = fakeSocket(1);
        deployBoardSocketHandler(socket, board);
        const answer = await socket.call("getDeployBoard");
        assert.strictEqual(answer.ok, true);
        assert.deepStrictEqual(Object.keys(answer.board).sort(), ["deploys", "generatedAt", "history", "sources"]);
    });

    test("pedido sem callback não derruba o handler", () => {
        const socket = fakeSocket(1);
        deployBoardSocketHandler(socket, board);
        assert.doesNotThrow(() => socket.raw("getDeployBoard", undefined));
        assert.doesNotThrow(() => socket.raw("getDeployBoard", "nao e funcao"));
    });

    test("a difusão alcança só sockets logados", () => {
        const anonymous = fakeSocket(null);
        const logged = fakeSocket(1);
        const otherUser = fakeSocket(2);
        const io = {
            sockets: {
                sockets: new Map([
                    ["a", anonymous],
                    ["b", logged],
                    ["c", otherUser],
                ]),
            },
        };
        const sent = broadcastToLoggedIn(io, { marker: 1 });
        assert.strictEqual(sent, 2);
        assert.deepStrictEqual(anonymous.emitted, []);
        assert.deepStrictEqual(logged.emitted, [{ event: UPDATE_EVENT, payload: { marker: 1 } }]);
        assert.strictEqual(otherUser.emitted.length, 1);
    });
});
