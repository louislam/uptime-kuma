const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const {
    DeployBoardStore,
    SOURCE_IDS,
    DEPLOY_PUBLIC_FIELDS,
    EMIT_INTERVAL_MS,
} = require("../../../server/deploy-board/store");

describe("Estado do painel de deploys", () => {
    let clock;
    let store;

    beforeEach(() => {
        mock.timers.enable({ apis: ["setTimeout"] });
        clock = 1_000_000;
        store = new DeployBoardStore({ now: () => clock });
    });

    afterEach(() => {
        store.close();
        mock.timers.reset();
    });

    /**
     * Advance the injected clock and the mocked timers together.
     * @param {number} ms Milliseconds.
     * @returns {void}
     */
    function advance(ms) {
        clock += ms;
        mock.timers.tick(ms);
    }

    test("toda fonte nasce não configurada, e o snapshot traz as quatro", () => {
        const { sources } = store.snapshot();
        assert.deepStrictEqual(Object.keys(sources), SOURCE_IDS);
        for (const id of SOURCE_IDS) {
            assert.deepStrictEqual(sources[id], { state: "unconfigured", lastDataAt: null, detail: null });
        }
    });

    test("estado desconhecido e fonte desconhecida lançam", () => {
        assert.throws(() => store.setSource("cluster", "ok"), /Unknown source state/);
        assert.throws(() => store.setSource("jenkins", "active"), /Unknown deploy source/);
    });

    test("dado novo reativa a fonte sem leitura e limpa o motivo", () => {
        store.setSource("cluster", "stale", "403 em gateway");
        store.markData("cluster");
        assert.deepStrictEqual(store.snapshot().sources.cluster, {
            state: "active",
            lastDataAt: clock,
            detail: null,
        });
    });

    test("o snapshot só leva os campos permitidos de um deploy", () => {
        // Controle positivo: o registro interno tem os campos; o que sai é só a lista permitida.
        store.deploys.push({ token: "segredo-plantado", env: { DB_PASSWORD: "x" } });
        store.history.push({ token: "segredo-plantado" });
        const snap = store.snapshot();
        const serialized = JSON.stringify(snap);
        assert.ok(JSON.stringify(store.deploys).includes("segredo-plantado"));
        assert.ok(!serialized.includes("segredo-plantado"));
        for (const deploy of [...snap.deploys, ...snap.history]) {
            for (const key of Object.keys(deploy)) {
                assert.ok(DEPLOY_PUBLIC_FIELDS.includes(key), `campo não permitido: ${key}`);
            }
        }
    });

    test("difusão: a primeira mudança sai na hora, as seguintes juntam numa só por intervalo", () => {
        const received = [];
        store.onChange((s) => received.push(s));

        store.setSource("cluster", "active");
        assert.strictEqual(received.length, 1);

        store.setSource("github", "active");
        store.setSource("bitbucket", "active");
        assert.strictEqual(received.length, 1, "dentro do intervalo nada sai");

        advance(EMIT_INTERVAL_MS);
        assert.strictEqual(received.length, 2);
        // A emissão atrasada carrega tudo que mudou no intervalo.
        assert.strictEqual(received[1].sources.github.state, "active");
        assert.strictEqual(received[1].sources.bitbucket.state, "active");
    });

    test("mudança que não muda nada não difunde", () => {
        const received = [];
        store.onChange((s) => received.push(s));
        store.setSource("cluster", "unconfigured");
        assert.strictEqual(received.length, 0);
    });

    test("um ouvinte que lança não impede os outros", () => {
        const received = [];
        store.onChange(() => {
            throw new Error("socket fechado");
        });
        store.onChange((s) => received.push(s));
        store.setSource("amplify", "active");
        assert.strictEqual(received.length, 1);
    });
});
