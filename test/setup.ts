import { initDayjs } from "../server/util";

initDayjs();

// Tests use invalid API keys on purpose; hide Better Auth's expected error logs.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Failed to validate API key")) {
        return;
    }
    originalConsoleError(...args);
};
