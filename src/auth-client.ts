import { createAuthClient } from "better-auth/vue";
import { usernameClient } from "better-auth/client/plugins";

export const baseURL =
    process.env.NODE_ENV === "development" || localStorage.dev === "dev"
        ? location.protocol + "//" + location.hostname + ":3001"
        : "";

export const authClient = createAuthClient({
    baseURL,
    plugins: [usernameClient()],
});

authClient.signIn;

/**
 * Check if the user is logged in
 */
export async function isLoggedIn() {
    const session = await authClient.getSession();
    return session.data !== null;
}

/**
 * @param username
 * @param password
 */
export async function login(username: string, password: string) {
    const { error } = await authClient.signIn.username({
        username,
        password,
    });

    if (error) {
        throw new Error(error.message);
    }

    // Refresh, so that WebSocket can be reconnected with new token
    location.reload();
}

/**
 * @param onSuccess
 */
export async function logout(onSuccess = () => {}) {
    await authClient.signOut({
        fetchOptions: {
            onSuccess,
        },
    });
}
