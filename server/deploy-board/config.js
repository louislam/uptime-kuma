const fs = require("fs");

/** Pipeline sources a project can come from. */
const PIPELINE_SOURCES = ["bitbucket", "github"];

/** A Kubernetes namespace or Helm release name (DNS-1123 label, dots allowed in releases). */
const NAMESPACE_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const RELEASE_RE = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;

/** owner/name, as Bitbucket and GitHub write it. */
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** AWS region, e.g. us-east-1. */
const REGION_RE = /^[a-z]{2}(-[a-z]+)+-\d$/;

/**
 * Validate the parsed configuration file of the deploy board.
 *
 * Every error names the field, because whoever reads it is looking at a ConfigMap and needs to know
 * which line to fix.
 * @param {any} raw Parsed JSON.
 * @returns {{config: object|null, error: string|null}} Normalized config, or the first error.
 */
function validateDeployBoardConfig(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return fail("the root must be an object");
    }

    if (!Array.isArray(raw.namespaces) || raw.namespaces.length === 0) {
        return fail("namespaces: expected a non-empty list");
    }
    for (let i = 0; i < raw.namespaces.length; i++) {
        if (typeof raw.namespaces[i] !== "string" || !NAMESPACE_RE.test(raw.namespaces[i])) {
            return fail(`namespaces[${i}]: not a valid namespace name`);
        }
    }
    const namespaces = [...new Set(raw.namespaces)];

    const projectsRaw = raw.projects === undefined ? [] : raw.projects;
    if (!Array.isArray(projectsRaw)) {
        return fail("projects: expected a list");
    }

    const projects = [];
    const names = new Set();
    for (let i = 0; i < projectsRaw.length; i++) {
        const p = projectsRaw[i];
        const at = `projects[${i}]`;

        if (!p || typeof p !== "object" || Array.isArray(p)) {
            return fail(`${at}: expected an object`);
        }
        if (typeof p.name !== "string" || p.name.trim() === "") {
            return fail(`${at}.name: expected a non-empty text`);
        }
        if (names.has(p.name)) {
            return fail(`${at}.name: "${p.name}" is repeated`);
        }
        names.add(p.name);
        if (!PIPELINE_SOURCES.includes(p.source)) {
            return fail(`${at}.source: expected one of ${PIPELINE_SOURCES.join(", ")}`);
        }
        if (typeof p.repo !== "string" || !REPO_RE.test(p.repo)) {
            return fail(`${at}.repo: expected "<owner>/<name>"`);
        }
        if (typeof p.branch !== "string" || p.branch.trim() === "") {
            return fail(`${at}.branch: expected a non-empty text`);
        }
        if (!Array.isArray(p.releases)) {
            return fail(`${at}.releases: expected a list`);
        }

        const releases = [];
        for (let j = 0; j < p.releases.length; j++) {
            const ref = p.releases[j];
            const parts = typeof ref === "string" ? ref.split("/") : [];
            if (parts.length !== 2 || !NAMESPACE_RE.test(parts[0]) || !RELEASE_RE.test(parts[1])) {
                return fail(`${at}.releases[${j}]: expected "<namespace>/<release>"`);
            }
            // A release in a namespace nobody watches would never show a rollout, silently.
            if (!namespaces.includes(parts[0])) {
                return fail(`${at}.releases[${j}]: namespace "${parts[0]}" is not in namespaces`);
            }
            releases.push({ namespace: parts[0], release: parts[1] });
        }

        projects.push({
            name: p.name,
            source: p.source,
            repo: p.repo,
            branch: p.branch,
            releases,
        });
    }

    let amplify = null;
    if (raw.amplify !== undefined) {
        if (!raw.amplify || typeof raw.amplify !== "object" || Array.isArray(raw.amplify)) {
            return fail("amplify: expected an object");
        }
        if (typeof raw.amplify.region !== "string" || !REGION_RE.test(raw.amplify.region)) {
            return fail("amplify.region: expected an AWS region, e.g. us-east-1");
        }
        amplify = { region: raw.amplify.region };
    }

    return {
        config: { namespaces, projects, amplify },
        error: null,
    };
}

/**
 * Read the configuration file named by DEPLOY_BOARD_CONFIG.
 *
 * Never throws: a broken file must not keep Kuma from booting. The caller turns `status` into
 * "every deploy source off" and logs `error`.
 * @param {object} env Environment (process.env by default).
 * @returns {{status: "missing"|"invalid"|"ok", path: string|null, config: object|null, error: string|null}} Result.
 */
function loadDeployBoardConfig(env = process.env) {
    const path = env.DEPLOY_BOARD_CONFIG || null;
    if (!path) {
        return { status: "missing", path: null, config: null, error: null };
    }

    let text;
    try {
        text = fs.readFileSync(path, "utf8");
    } catch (e) {
        return {
            status: "invalid",
            path,
            config: null,
            error: `${path}: cannot read the file (${e.code || e.message})`,
        };
    }

    let raw;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        return { status: "invalid", path, config: null, error: `${path}: invalid JSON (${e.message})` };
    }

    const { config, error } = validateDeployBoardConfig(raw);
    if (error) {
        return { status: "invalid", path, config: null, error: `${path}: ${error}` };
    }
    return { status: "ok", path, config, error: null };
}

/**
 * @param {string} message Error message.
 * @returns {{config: null, error: string}} Failed validation.
 */
function fail(message) {
    return { config: null, error: message };
}

module.exports = {
    PIPELINE_SOURCES,
    validateDeployBoardConfig,
    loadDeployBoardConfig,
};
