import { config } from "@vue/test-utils";
import { vi } from "vitest";

// Setup global mocks
vi.mock("vue-i18n", () => ({
    useI18n: () => ({
        t: (key) => key,
    }),
}));

// Global components mock
config.global.stubs = {
    "font-awesome-icon": true,
};

// Global mounting options
config.global.mocks = {
    $t: (key) => key,
    $filters: {
        formatDateTime: vi.fn((date) => date.toString()),
    },
};
