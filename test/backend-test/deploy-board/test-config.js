process.env.UPTIME_KUMA_HIDE_LOG = ["error_deploy-board", "info_deploy-board"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { validateDeployBoardConfig, loadDeployBoardConfig } = require("../../../server/deploy-board/config");
const { DeployBoard } = require("../../../server/deploy-board");
const { SOURCE_IDS } = require("../../../server/deploy-board/store");

/** The configuration of the design doc, with the real projects of today. */
const VALID = {
    namespaces: ["condominio", "gateway", "connector", "chat", "monitor-infra"],
    amplify: { region: "us-east-1" },
    projects: [
        {
            name: "condominio",
            source: "bitbucket",
            repo: "winker/condominio",
            branch: "master",
            releases: ["condominio/winker-prod", "condominio/winker-integration"],
        },
        { name: "chat", source: "github", repo: "gladfy/chat", branch: "master", releases: ["chat/chatwoot"] },
    ],
};

/**
 * @param {object} patch Fields to replace in a copy of VALID.
 * @returns {object} Modified copy.
 */
function variant(patch) {
    return { ...structuredClone(VALID), ...patch };
}

describe("Configuração do painel de deploys", () => {
    let dir;

    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-board-config-"));
    });

    after(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    /**
     * @param {string} name File name.
     * @param {string} content File content.
     * @returns {string} Full path.
     */
    function writeFile(name, content) {
        const file = path.join(dir, name);
        fs.writeFileSync(file, content);
        return file;
    }

    test("arquivo válido é normalizado: release vira namespace + nome", () => {
        const { config, error } = validateDeployBoardConfig(VALID);
        assert.strictEqual(error, null);
        assert.deepStrictEqual(config.projects[0].releases, [
            { namespace: "condominio", release: "winker-prod" },
            { namespace: "condominio", release: "winker-integration" },
        ]);
        assert.deepStrictEqual(config.amplify, { region: "us-east-1" });
    });

    test("amplify e projects são opcionais (a fase 2 usa só namespaces e projects)", () => {
        const { config, error } = validateDeployBoardConfig({ namespaces: ["condominio"] });
        assert.strictEqual(error, null);
        assert.deepStrictEqual(config.projects, []);
        assert.strictEqual(config.amplify, null);
    });

    test("campo errado: a mensagem nomeia o campo", () => {
        const cases = [
            [variant({ namespaces: [] }), "namespaces"],
            [variant({ namespaces: ["Condominio"] }), "namespaces[0]"],
            [variant({ projects: "x" }), "projects"],
            [variant({ projects: [{ ...VALID.projects[0], source: "gitlab" }] }), "projects[0].source"],
            [variant({ projects: [{ ...VALID.projects[0], repo: "condominio" }] }), "projects[0].repo"],
            [variant({ projects: [{ ...VALID.projects[0], branch: "" }] }), "projects[0].branch"],
            [variant({ projects: [{ ...VALID.projects[0], releases: ["winker-prod"] }] }), "projects[0].releases[0]"],
            [variant({ projects: [VALID.projects[0], VALID.projects[0]] }), "projects[1].name"],
            [variant({ amplify: { region: "virginia" } }), "amplify.region"],
        ];
        for (const [raw, field] of cases) {
            const { config, error } = validateDeployBoardConfig(raw);
            assert.strictEqual(config, null, `${field} deveria reprovar`);
            assert.ok(error.startsWith(`${field}:`), `esperava erro em ${field}, veio: ${error}`);
        }
    });

    test("release num namespace que ninguém observa é recusada", () => {
        const raw = variant({ projects: [{ ...VALID.projects[0], releases: ["gateway-x/gateway-prod"] }] });
        const { error } = validateDeployBoardConfig(raw);
        assert.match(error, /^projects\[0\]\.releases\[0\]: namespace "gateway-x" is not in namespaces$/);
    });

    test("sem DEPLOY_BOARD_CONFIG: status missing, sem erro", () => {
        assert.deepStrictEqual(loadDeployBoardConfig({}), { status: "missing", path: null, config: null, error: null });
    });

    test("arquivo ausente, JSON inválido e campo errado: status invalid com arquivo e motivo", () => {
        const missing = path.join(dir, "nao-existe.json");
        const broken = writeFile("quebrado.json", "{ namespaces: ");
        const wrong = writeFile("errado.json", JSON.stringify(variant({ namespaces: [] })));

        const r1 = loadDeployBoardConfig({ DEPLOY_BOARD_CONFIG: missing });
        assert.strictEqual(r1.status, "invalid");
        assert.ok(r1.error.startsWith(`${missing}: cannot read the file`));

        const r2 = loadDeployBoardConfig({ DEPLOY_BOARD_CONFIG: broken });
        assert.strictEqual(r2.status, "invalid");
        assert.ok(r2.error.startsWith(`${broken}: invalid JSON`));

        const r3 = loadDeployBoardConfig({ DEPLOY_BOARD_CONFIG: wrong });
        assert.strictEqual(r3.status, "invalid");
        assert.strictEqual(r3.error, `${wrong}: namespaces: expected a non-empty list`);
    });

    test("arquivo válido no disco: status ok", () => {
        const file = writeFile("ok.json", JSON.stringify(VALID));
        const r = loadDeployBoardConfig({ DEPLOY_BOARD_CONFIG: file });
        assert.strictEqual(r.status, "ok");
        assert.strictEqual(r.config.projects.length, 2);
    });

    test("configuração inválida não derruba o boot e deixa todas as fontes desligadas", () => {
        const broken = writeFile("quebrado-boot.json", "nao e json");
        const board = new DeployBoard({ env: { DEPLOY_BOARD_CONFIG: broken } });
        assert.doesNotThrow(() => board.start(null));
        assert.strictEqual(board.configStatus, "invalid");
        const { sources } = board.getSnapshot();
        for (const id of SOURCE_IDS) {
            assert.strictEqual(sources[id].state, "unconfigured", id);
        }
        board.store.close();
    });

    test("start() é idempotente: a difusão é registrada uma vez só", () => {
        const board = new DeployBoard({ env: {} });
        const io = { sockets: { sockets: new Map() } };
        board.start(io);
        board.start(io);
        assert.strictEqual(board.store.listeners.size, 1);
        board.store.close();
    });
});
