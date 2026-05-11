/* eslint-disable jsdoc/require-jsdoc */

const REQUIRED_SERVICE_KEY_FIELDS = [
    "TWINGATE_NETWORK",
    "TWINGATE_SERVICE_ACCOUNT_ID",
    "TWINGATE_KEY_ID",
];

function resolveTwingateServiceKey(env = process.env) {
    if (env.TWINGATE_SERVICE_KEY_B64) {
        return {
            configured: true,
            value: Buffer.from(env.TWINGATE_SERVICE_KEY_B64, "base64"),
            missing: [],
            source: "TWINGATE_SERVICE_KEY_B64",
        };
    }

    if (env.TWINGATE_SERVICE_KEY_JSON) {
        return {
            configured: true,
            value: Buffer.from(env.TWINGATE_SERVICE_KEY_JSON, "utf8"),
            missing: [],
            source: "TWINGATE_SERVICE_KEY_JSON",
        };
    }

    const missing = missingServiceKeyFields(env);
    const privateKey = normalizePrivateKey(env);
    if (!privateKey) {
        missing.push("TWINGATE_PRIVATE_KEY or TWINGATE_PRIVATE_KEY_B64");
    }

    if (missing.length > 0) {
        return {
            configured: false,
            value: null,
            missing,
            source: "TWINGATE_*",
        };
    }

    const serviceKey = {
        version: env.TWINGATE_SERVICE_KEY_VERSION || "1",
        network: env.TWINGATE_NETWORK,
        service_account_id: env.TWINGATE_SERVICE_ACCOUNT_ID,
        private_key: privateKey,
        key_id: env.TWINGATE_KEY_ID,
        expires_at: env.TWINGATE_EXPIRES_AT || null,
        login_path: env.TWINGATE_LOGIN_PATH || "/api/v4/headless/login",
    };

    return {
        configured: true,
        value: Buffer.from(JSON.stringify(serviceKey), "utf8"),
        missing: [],
        source: "TWINGATE_*",
    };
}

function hasTwingateServiceKeyInput(env = process.env) {
    return Boolean(
        env.TWINGATE_SERVICE_KEY_B64 ||
        env.TWINGATE_SERVICE_KEY_JSON ||
        env.TWINGATE_PRIVATE_KEY ||
        env.TWINGATE_PRIVATE_KEY_B64 ||
        REQUIRED_SERVICE_KEY_FIELDS.some((field) => env[field])
    );
}

function missingServiceKeyFields(env) {
    return REQUIRED_SERVICE_KEY_FIELDS.filter((field) => !env[field]);
}

function normalizePrivateKey(env) {
    const rawPrivateKey = env.TWINGATE_PRIVATE_KEY ||
        decodeBase64Value(env.TWINGATE_PRIVATE_KEY_B64);
    if (!rawPrivateKey) {
        return "";
    }
    return rawPrivateKey.replace(/\\n/g, "\n").trimEnd();
}

function decodeBase64Value(value) {
    if (!value) {
        return "";
    }
    return Buffer.from(value, "base64").toString("utf8");
}

module.exports = {
    hasTwingateServiceKeyInput,
    resolveTwingateServiceKey,
};
