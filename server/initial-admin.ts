import { log } from "../src/util";
import { createFirstAdmin, hasUser } from "./routers/better-auth-router";

/**
 * Create the initial admin user from environment variables.
 * Only runs when Uptime Kuma has no user yet.
 * @returns {Promise<boolean>} Whether an admin user was created
 * @throws {Error} If only one variable is set, or the user cannot be created
 */
export async function initAdminFromEnv() {
    const username = process.env.UK_INITIAL_ADMIN_USERNAME?.trim();
    const password = process.env.UK_INITIAL_ADMIN_PASSWORD;

    if (!username && !password) {
        return false;
    }

    // Ignore the variables once a user exists, even if their config is now invalid
    if (await hasUser(true)) {
        log.info("auth", "Uptime Kuma is already initialized, ignoring UK_INITIAL_ADMIN_* environment variables.");
        return false;
    }

    if (!username || !password) {
        throw new Error("UK_INITIAL_ADMIN_USERNAME and UK_INITIAL_ADMIN_PASSWORD must be set together.");
    }

    await createFirstAdmin(username, password);
    log.info("auth", `Created the initial admin user "${username}" from environment variables.`);
    return true;
}
