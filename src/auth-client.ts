import { createAuthClient } from "better-auth/vue";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";
import { reconnectSocket } from "./mixins/socket";

export const baseURL =
    process.env.NODE_ENV === "development" || localStorage.dev === "dev"
        ? location.protocol + "//" + location.hostname + ":3001"
        : "";

export const authClient = createAuthClient({
    baseURL,
    plugins: [usernameClient(), twoFactorClient(), apiKeyClient()],
});
/**
 * @returns Check if the user is logged in
 */
export async function isLoggedIn() {
    const session = await authClient.getSession();
    return session.data !== null;
}

/**
 * @param username Username
 * @param password Password
 * @param remember Remember Me
 */
export async function login(username: string, password: string, remember: boolean = true) {
    const { data, error } = await authClient.signIn.username({
        username,
        password,
        rememberMe: remember,
    });

    if (error) {
        throw new Error(error.message);
    }

    if ("twoFactorRedirect" in data) {
        return "twoFactorRequired";
    }

    reconnectSocket();
}

/**
 * Start the Aegis authorization code flow (PKCE). The server answers with the authorization URL
 * and the client follows it, so this only returns when the redirect could not be started.
 */
export async function loginWithAegis() {
    const returnURL = location.origin + "/dashboard";
    const { error } = await authClient.signIn.social({
        provider: "aegis",
        callbackURL: returnURL,
        errorCallbackURL: returnURL,
    });

    if (error) {
        throw new Error(error.message || "Sign-in could not be started. Try again.");
    }
}

/**
 * @param token Token
 */
export async function verifyTotp(token: string) {
    const { error } = await authClient.twoFactor.verifyTotp({
        code: token,
    });

    if (error) {
        throw new Error(error.message);
    }

    reconnectSocket();
}

/**
 * Sign out. For an Aegis session the server returns the Aegis end-session URL
 * and the client follows it, so the Aegis session ends as well.
 * @param onSuccess
 */
export async function logout(onSuccess = () => {}) {
    await authClient.signOut({
        fetchOptions: {
            onSuccess,
        },
    });
}
