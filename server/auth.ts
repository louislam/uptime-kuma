import expressBasicAuth from "express-basic-auth";
import dayjs from "dayjs";
import { R } from "redbean-node";
import type express from "express";
import { log } from "../src/util";
import { loginRateLimiter, apiRateLimiter } from "./rate-limiter";
import { Settings } from "./settings";
import { checkPassword, verifyApiKey as verifyBetterAuthAPIKey, getSessionFromHeaders } from "./better-auth";
// @ts-ignore
import passwordHash from "./password-hash";

/**
 * Callback for basic auth authorizers
 * @param err Any error encountered
 * @param authorized Is the client authorized?
 */
type AuthCallback = (err: Error | null, authorized: boolean) => void;

/**
 * @deprecated DO NOT CALL IT. Use Better Auth instead.
 * Old Login function, keep it for migration purposes.
 * @param username Username to login with
 * @param password Password to login with
 * @returns User or null if login failed
 */
export async function login(username: string, password: string) {
    if (typeof username !== "string" || typeof password !== "string") {
        return null;
    }

    const user: any = await R.findOne("user", "TRIM(username) = ? AND active = 1 ", [username.trim()]);

    if (user && passwordHash.verify(password, user.password)) {
        // Upgrade the hash to bcrypt
        if (passwordHash.needRehash(user.password)) {
            await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
                await passwordHash.generate(password),
                user.id,
            ]);
        }
        return user;
    }

    return null;
}

/**
 * Validate a provided API key
 * @param key API key to verify
 * @returns API is ok?
 */
async function verifyAPIKey(key: string) {
    if (typeof key !== "string") {
        return false;
    }

    // Better Auth API keys
    if (await verifyBetterAuthAPIKey(key)) {
        return true;
    }

    // Legacy API keys, kept in the old `api_key` table
    return await verifyLegacyAPIKey(key);
}

/**
 * Verify a legacy API key (uk<id>_<clear>, bcrypt hash in the old `api_key` table)
 * @param key API key to verify
 * @returns API is ok?
 */
async function verifyLegacyAPIKey(key: string) {
    // uk prefix + key ID is before _
    const index = key.substring(2, key.indexOf("_"));
    const clear = key.substring(key.indexOf("_") + 1, key.length);

    if (!index || !clear) {
        return false;
    }

    const hash: any = await R.findOne("api_key", " id=? ", [index]);

    if (hash === null) {
        return false;
    }

    const current = dayjs();
    const expiry = dayjs(hash.expires);
    if (expiry.diff(current) < 0 || !hash.active) {
        return false;
    }

    return passwordHash.verify(clear, hash.key);
}

/**
 * Custom authorizer for express-basic-auth
 * @param username Username to login with
 * @param password Password to login with
 * @param callback Callback to handle login result
 */
function apiAuthorizer(username: string, password: string, callback: AuthCallback) {
    // API Rate Limit
    apiRateLimiter.pass(null, 0).then((pass: boolean) => {
        if (pass) {
            verifyAPIKey(password).then((valid: boolean) => {
                if (!valid) {
                    log.warn("api-auth", "Failed API auth attempt: invalid API Key");
                }
                callback(null, valid);
                // Only allow a set number of api requests per minute
                // (currently set to 60)
                apiRateLimiter.removeTokens(1);
            });
        } else {
            log.warn("api-auth", "Failed API auth attempt: rate limit exceeded");
            callback(null, false);
        }
    });
}

/**
 * Custom authorizer for express-basic-auth
 * @param username Username to login with
 * @param password Password to login with
 * @param callback Callback to handle login result
 */
function userAuthorizer(username: string, password: string, callback: AuthCallback) {
    // Login Rate Limit
    loginRateLimiter.pass(null, 0).then((pass: boolean) => {
        if (pass) {
            checkPassword(username, password)
                .then((valid: boolean) => {
                    callback(null, valid);

                    if (!valid) {
                        log.warn("basic-auth", "Failed basic auth attempt: invalid username/password");
                        loginRateLimiter.removeTokens(1);
                    }
                })
                .catch((e: Error) => {
                    log.error("basic-auth", "Auth error:", e);
                    callback(null, false);
                });
        } else {
            log.warn("basic-auth", "Failed basic auth attempt: rate limit exceeded");
            callback(null, false);
        }
    });
}

/**
 * Use basic auth if auth is not disabled
 * @param req Express request object
 * @param res Express response object
 * @param next Next handler in chain
 * @returns Promise resolved when the middleware is done
 */
export async function basicAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const middleware = expressBasicAuth({
        authorizer: userAuthorizer,
        authorizeAsync: true,
        challenge: true,
    });

    const disabledAuth = await Settings.get("disableAuth");

    if (!disabledAuth) {
        middleware(req, res, next);
    } else {
        next();
    }
}

/**
 * Use use API Key if API keys enabled, else use basic auth
 * @param req Express request object
 * @param res Express response object
 * @param next Next handler in chain
 * @returns Promise resolved when the middleware is done
 */
export async function apiAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!(await Settings.get("disableAuth"))) {
        const usingAPIKeys = await Settings.get("apiKeysEnabled");
        let middleware;
        if (usingAPIKeys) {
            middleware = expressBasicAuth({
                authorizer: apiAuthorizer,
                authorizeAsync: true,
                challenge: true,
            });
        } else {
            middleware = expressBasicAuth({
                authorizer: userAuthorizer,
                authorizeAsync: true,
                challenge: true,
            });
        }
        middleware(req, res, next);
    } else {
        next();
    }
}

// Exported for tests
export { verifyAPIKey };

/**
 * Read an API key from the `Authorization` header, the last word of it
 * @param authorization Value of the `Authorization` header
 * @returns API key, or null when the header is missing
 */
export function readApiKey(authorization?: string | string[]): string | null {
    if (typeof authorization !== "string") {
        return null;
    }

    const parts = authorization.trim().split(" ");

    return parts[parts.length - 1] || null;
}

/**
 * Express middleware that requires a valid API key and applies the API rate limit.
 * Sets `response.locals.apiKey` and `response.locals.session` for the route.
 * @param req Express request
 * @param res Express response
 * @param next Next handler in chain
 * @returns Promise resolved when the middleware is done
 */
export async function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!(await Settings.get("apiEnabled"))) {
        res.status(403).json({
            ok: false,
            msg: "The API is disabled",
        });
        return;
    }

    // One token per request, a rejected request still counts
    if (!(await apiRateLimiter.pass(null, 1))) {
        res.status(429).json({
            ok: false,
            msg: "Too frequently, try again later.",
        });
        return;
    }

    const apiKey = readApiKey(req.headers.authorization);

    if (!apiKey) {
        res.status(401).json({
            ok: false,
            msg: "Missing API key",
        });
        return;
    }

    // Authenticate with the API key only, never with a browser cookie
    const session = await getSessionFromHeaders(undefined, apiKey);

    if (!session) {
        log.warn("api-auth", "Failed API auth attempt: invalid API Key");
        res.status(401).json({
            ok: false,
            msg: "Invalid API key",
        });
        return;
    }

    res.locals.apiKey = apiKey;
    res.locals.session = session;
    next();
}
