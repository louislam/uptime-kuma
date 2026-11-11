import { log } from "../src/util";

/**
 * Aegis is the KyroNET OpenID Connect identity provider.
 *
 * Sign-in with Aegis is enabled when `AUTH_CLIENT_SECRET` is set. The other values have defaults that match the
 * client registered on the auth server, and each can be overridden with its environment variable:
 *
 * - `AUTH_ISSUER`
 * - `AUTH_CLIENT_ID`
 * - `AUTH_CLIENT_SECRET` (required, never stored in the repository)
 * - `AUTH_REDIRECT_URI`
 * - `AUTH_ALLOWED_USERS` (optional, comma separated emails, usernames or subject ids allowed to sign in;
 *   everyone with an Aegis account for this client when unset)
 */
export const AEGIS_PROVIDER_ID = "aegis";

const DEFAULT_ISSUER = "https://auth.kyro.dog";
const DEFAULT_CLIENT_ID = "tVseuD7pEWy7bJRHOtY83HSeAZLxlf2q";
const DEFAULT_REDIRECT_URI = "https://status.kyro.cat/api/auth/callback";

export interface AegisConfig {
    issuer: string;
    discoveryUrl: string;
    clientId: string;
    clientSecret: string;
    redirectURI: string;
    /** Origin of this application, derived from the redirect URI */
    appURL: string;
    scopes: string[];
    /** Lowercase emails, usernames or subject ids. Empty means everyone with an Aegis account for this client. */
    allowedUsers: string[];
}

let cachedConfig: AegisConfig | null | undefined;

/**
 * Read the Aegis configuration from the environment
 * @returns The configuration, or null when sign-in with Aegis is not enabled
 */
export function getAegisConfig(): AegisConfig | null {
    if (cachedConfig !== undefined) {
        return cachedConfig;
    }

    const clientSecret = process.env.AUTH_CLIENT_SECRET;
    if (!clientSecret) {
        cachedConfig = null;
        return cachedConfig;
    }

    const issuer = (process.env.AUTH_ISSUER || DEFAULT_ISSUER).replace(/\/+$/, "");
    const redirectURI = process.env.AUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI;

    let appURL: string;
    try {
        appURL = new URL(redirectURI).origin;
        new URL(issuer);
    } catch (e) {
        log.error("auth", "Aegis sign-in is disabled. AUTH_ISSUER and AUTH_REDIRECT_URI must be absolute URLs.");
        cachedConfig = null;
        return cachedConfig;
    }

    cachedConfig = {
        issuer,
        discoveryUrl: `${issuer}/.well-known/openid-configuration`,
        clientId: process.env.AUTH_CLIENT_ID || DEFAULT_CLIENT_ID,
        clientSecret,
        redirectURI,
        appURL,
        scopes: ["openid", "profile", "email", "offline_access"],
        allowedUsers: (process.env.AUTH_ALLOWED_USERS || "")
            .split(",")
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
    };

    return cachedConfig;
}

/**
 * @returns True when sign-in with Aegis is enabled
 */
export function isAegisEnabled(): boolean {
    return getAegisConfig() !== null;
}

/**
 * Check the identifiers of an Aegis user against `AUTH_ALLOWED_USERS`
 * @param config Aegis configuration
 * @param identifiers Subject id, email and name of the user
 * @returns True if the user may sign in
 */
export function isAegisUserAllowed(config: AegisConfig, identifiers: unknown[]): boolean {
    if (config.allowedUsers.length === 0) {
        return true;
    }

    return identifiers
        .filter((value) => typeof value === "string" && value !== "")
        .some((value) => config.allowedUsers.includes(String(value).toLowerCase()));
}

/**
 * Check whether the Aegis issuer answers, to tell a rejected refresh token from an outage
 * @param config Aegis configuration
 * @returns True if the discovery document can be fetched
 */
export async function isAegisReachable(config: AegisConfig): Promise<boolean> {
    try {
        const response = await fetch(config.discoveryUrl, {
            signal: AbortSignal.timeout(5000),
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}
