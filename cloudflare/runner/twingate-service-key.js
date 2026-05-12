/* eslint-disable jsdoc/require-jsdoc */

const REQUIRED_SERVICE_KEY_FIELDS = [
    "TWINGATE_NETWORK",
    "TWINGATE_SERVICE_ACCOUNT_ID",
    "TWINGATE_KEY_ID",
];

function resolveTwingateServiceKey(env = process.env) {
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
    if (privateKey.error) {
        return {
            configured: false,
            value: null,
            missing: [...missing, privateKey.error],
            source: "TWINGATE_*",
        };
    }

    if (privateKey.value && missing.length === 0) {
        const serviceKey = {
            version: env.TWINGATE_SERVICE_KEY_VERSION || "1",
            network: env.TWINGATE_NETWORK,
            service_account_id: env.TWINGATE_SERVICE_ACCOUNT_ID,
            private_key: privateKey.value,
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

    if (env.TWINGATE_SERVICE_KEY_B64) {
        return {
            configured: true,
            value: decodeServiceKeyValue(env.TWINGATE_SERVICE_KEY_B64),
            missing: [],
            source: "TWINGATE_SERVICE_KEY_B64",
        };
    }

    if (!privateKey.value) {
        missing.push("TWINGATE_PRIVATE_KEY or TWINGATE_PRIVATE_KEY_B64");
    }

    return {
        configured: false,
        value: null,
        missing,
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
    const source = env.TWINGATE_PRIVATE_KEY ? "TWINGATE_PRIVATE_KEY" :
        (env.TWINGATE_PRIVATE_KEY_B64 ? "TWINGATE_PRIVATE_KEY_B64" : "");
    const rawPrivateKey = env.TWINGATE_PRIVATE_KEY ||
        decodeBase64Value(env.TWINGATE_PRIVATE_KEY_B64);
    if (!rawPrivateKey) {
        return { value: "", error: null };
    }

    if (looksLikeJsonObject(rawPrivateKey)) {
        const message = source === "TWINGATE_PRIVATE_KEY_B64"
            ? "TWINGATE_PRIVATE_KEY_B64 must decode to only the PEM private_key value, not the full service key JSON"
            : "TWINGATE_PRIVATE_KEY must contain only the PEM private_key value, not the full service key JSON";
        return { value: "", error: message };
    }

    const privateKey = rawPrivateKey.replace(/\\n/g, "\n").trim();
    if (!hasPrivateKeyPemBoundaries(privateKey)) {
        return {
            value: "",
            error: `${source} must be a PEM private key with BEGIN and END private key boundaries`,
        };
    }

    return { value: privateKey, error: null };
}

function decodeBase64Value(value) {
    if (!value) {
        return "";
    }
    return Buffer.from(value, "base64").toString("utf8");
}

function decodeServiceKeyValue(value) {
    const rawValue = typeof value === "string" ? value : JSON.stringify(value);
    if (looksLikeJsonObject(rawValue)) {
        return Buffer.from(rawValue, "utf8");
    }
    return Buffer.from(rawValue, "base64");
}

function looksLikeJsonObject(value) {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{")) {
        return false;
    }
    return true;
}

function hasPrivateKeyPemBoundaries(value) {
    return /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value) &&
        /-----END [A-Z ]*PRIVATE KEY-----/.test(value);
}

module.exports = {
    hasTwingateServiceKeyInput,
    resolveTwingateServiceKey,
};
