<template>
    <div>
        <div class="my-4">
            <h3>{{ $t("twingateSettingsTitle") }}</h3>
            <p class="form-text">
                {{ $t("twingateSettingsDescription") }}
            </p>
        </div>

        <div class="my-3">
            <div class="mb-2">
                <strong>{{ $t("Status") }}: </strong>
                <span>{{ statusText }}</span>
            </div>
            <div v-if="showLogPanel" class="twingate-log-panel">
                <div class="twingate-log-header">
                    <div class="twingate-log-heading">
                        <div class="twingate-log-title">{{ $t("twingateRecentLog") }}</div>
                        <div class="twingate-log-summary">
                            {{ $t("twingateLogDescription") }}
                        </div>
                    </div>
                    <div class="twingate-log-actions">
                        <span class="twingate-log-count">
                            {{ logLineCountText }}
                        </span>
                        <button class="btn btn-outline-primary btn-sm twingate-log-button" type="button" @click="copyLogs">
                            {{ copyLogButtonText }}
                        </button>
                        <button class="btn btn-outline-secondary btn-sm twingate-log-button" type="button" @click="clearLogs">
                            {{ $t("twingateClearLog") }}
                        </button>
                    </div>
                </div>

                <ol class="twingate-log-list">
                    <li
                        v-for="(line, index) in logLines"
                        :key="index"
                        class="twingate-log-line"
                        :class="`is-${line.level}`"
                    >
                        <span class="twingate-log-number">{{ index + 1 }}</span>
                        <span class="twingate-log-level">{{ line.levelLabel }}</span>
                        <span v-if="line.timestamp" class="twingate-log-time">{{ line.timestamp }}</span>
                        <span class="twingate-log-message">{{ line.message }}</span>
                    </li>
                </ol>
                <textarea
                    ref="hiddenLogTextarea"
                    class="twingate-hidden-copy-field"
                    aria-hidden="true"
                    readonly
                    tabindex="-1"
                    :value="normalizedLogText"
                ></textarea>
            </div>
        </div>

        <button class="btn btn-primary" type="button" :disabled="loading" @click="loadStatus">
            {{ $t("refreshTwingateStatus") }}
        </button>

        <div v-if="settingsLoaded" class="twingate-alert-settings my-4 pt-4">
            <h5 class="my-4 settings-subheading">{{ $t("twingateAlertSettings") }}</h5>

            <div class="form-check form-switch my-3">
                <input
                    id="twingate-alert-enabled"
                    v-model="settings.twingateAlertEnabled"
                    class="form-check-input"
                    type="checkbox"
                    @change="onTwingateAlertEnabledChange"
                />
                <label class="form-check-label" for="twingate-alert-enabled">
                    {{ $t("twingateAlertEnabled") }}
                </label>
            </div>
            <p class="form-text">
                {{ $t("twingateAlertDescription") }}
            </p>

            <div v-if="settings.twingateAlertEnabled" class="twingate-alert-options">
                <div class="my-3 col-12 col-xl-6">
                    <label for="twingate-alert-threshold" class="form-label">
                        {{ $t("twingateAlertThresholdMinutes") }}
                    </label>
                    <input
                        id="twingate-alert-threshold"
                        v-model="settings.twingateAlertThresholdMinutes"
                        type="number"
                        min="1"
                        max="1440"
                        step="1"
                        class="form-control"
                    />
                    <div class="form-text">
                        {{ $t("twingateAlertThresholdDescription") }}
                    </div>
                </div>

                <div class="my-4">
                    <h6 class="mb-2">{{ $t("Notifications") }}</h6>
                    <p v-if="$root.notificationList.length === 0">
                        {{ $t("Not available, please setup.") }}
                    </p>

                    <div
                        v-for="notification in $root.notificationList"
                        :key="notification.id"
                        class="form-check form-switch my-3"
                    >
                        <input
                            :id="'twingate-alert-notification' + notification.id"
                            v-model="settings.twingateAlertNotificationIDList[notification.id]"
                            class="form-check-input"
                            type="checkbox"
                        />
                        <label
                            class="form-check-label"
                            :for="'twingate-alert-notification' + notification.id"
                        >
                            {{ notification.name }}
                            <a href="#" @click.prevent="$refs.notificationDialog.show(notification.id)">
                                {{ $t("Edit") }}
                            </a>
                        </label>
                        <span v-if="notification.isDefault == true" class="badge bg-primary ms-2">
                            {{ $t("Default") }}
                        </span>
                    </div>

                    <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                        {{ $t("Setup Notification") }}
                    </button>
                </div>
            </div>

            <button class="btn btn-primary" type="button" @click="saveSettings()">
                {{ $t("Save") }}
            </button>
        </div>

        <NotificationDialog ref="notificationDialog" />
    </div>
</template>

<script>
import NotificationDialog from "../../components/NotificationDialog.vue";
import { cloudflareWorkerApiHeaders } from "../../cloudflare-worker-api";

const DEFAULT_TWINGATE_STATUS_BROWSER_TIMEOUT_MS = 12000;

/**
 * Resolve the browser-side timeout for Twingate status checks.
 * @returns {number} Timeout in milliseconds.
 */
function resolveTwingateStatusBrowserTimeoutMs() {
    return DEFAULT_TWINGATE_STATUS_BROWSER_TIMEOUT_MS;
}

export default {
    components: {
        NotificationDialog,
    },

    data() {
        return {
            loading: false,
            status: {
                configured: false,
                starting: false,
                running: false,
                lastError: null,
            },
            logsCleared: false,
            copyState: "idle",
            copyResetTimeout: null,
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },

        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },

        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },

        showLogPanel() {
            return Boolean(this.status.lastError) && !this.logsCleared;
        },

        normalizedLogText() {
            if (!this.status.lastError) {
                return "";
            }

            return String(this.status.lastError)
                .trim()
                .replace(/;\s+(?=\[\d{4}-\d{2}-\d{2}T)/g, ";\n")
                .replace(/\s+(?=\[\d{4}-\d{2}-\d{2}T)/g, "\n");
        },

        logLines() {
            if (!this.normalizedLogText) {
                return [];
            }

            return this.normalizedLogText
                .split(/\n+/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => this.formatLogLine(line));
        },

        logLineCountText() {
            const count = this.logLines.length;
            const label = count === 1 ? this.$t("twingateLogLine") : this.$t("twingateLogLines");

            return `${count} ${label}`;
        },

        copyLogButtonText() {
            if (this.copyState === "copied") {
                return this.$t("twingateLogCopied");
            }
            if (this.copyState === "failed") {
                return this.$t("twingateLogCopyFailed");
            }
            return this.$t("twingateCopyLog");
        },

        statusText() {
            if (this.loading) {
                return this.$t("Loading...");
            }
            if (!this.status.configured) {
                return this.$t("twingateNotConfigured");
            }
            if (this.status.starting) {
                return this.$t("twingateStarting");
            }
            if (this.status.running) {
                return this.$t("Running");
            }
            return this.$t("twingateConfiguredStopped");
        },
    },

    watch: {
        settingsLoaded(loaded) {
            if (loaded) {
                this.ensureTwingateAlertSettings();
            }
        },
    },

    mounted() {
        this.ensureTwingateAlertSettings();
        this.loadStatus();
    },

    unmounted() {
        clearTimeout(this.copyResetTimeout);
    },

    methods: {
        ensureTwingateAlertSettings() {
            if (!this.settings) {
                return;
            }
            if (this.settings.twingateAlertEnabled === undefined) {
                this.settings.twingateAlertEnabled = false;
            }
            if (
                !this.settings.twingateAlertNotificationIDList ||
                typeof this.settings.twingateAlertNotificationIDList !== "object" ||
                Array.isArray(this.settings.twingateAlertNotificationIDList)
            ) {
                this.settings.twingateAlertNotificationIDList = {};
            }
            const threshold = Number.parseInt(this.settings.twingateAlertThresholdMinutes, 10);
            this.settings.twingateAlertThresholdMinutes = Number.isFinite(threshold) && threshold > 0 ? threshold : 5;
        },

        onTwingateAlertEnabledChange() {
            this.ensureTwingateAlertSettings();
            if (!this.settings.twingateAlertEnabled || this.hasSelectedTwingateAlertNotification()) {
                return;
            }
            for (const notification of this.$root.notificationList) {
                if (notification.isDefault === true) {
                    this.settings.twingateAlertNotificationIDList[notification.id] = true;
                }
            }
        },

        hasSelectedTwingateAlertNotification() {
            return Object.values(this.settings.twingateAlertNotificationIDList || {}).some((enabled) => enabled === true);
        },

        clearLogs() {
            this.logsCleared = true;
            this.copyState = "idle";
            clearTimeout(this.copyResetTimeout);
        },

        async copyLogs() {
            try {
                await this.writeClipboard(this.normalizedLogText);
                this.setCopyState("copied");
            } catch {
                this.setCopyState("failed");
            }
        },

        formatLogLine(line) {
            const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]\s*(.*)$/);
            const message = timestampMatch ? timestampMatch[2] : line;
            const severityMatch = message.match(/\[(ERROR|WARNING|WARN|INFO|DEBUG)\]/i);
            const severity = severityMatch ? severityMatch[1].toLowerCase() : "";
            let level = "status";

            if (severity === "error" || /\b(error|failed|failure|unrecoverable)\b/i.test(message)) {
                level = "error";
            } else if (severity === "warning" || severity === "warn" || /\b(warning|disabled)\b/i.test(message)) {
                level = "warning";
            } else if (severity === "debug") {
                level = "debug";
            } else if (severity === "info") {
                level = "info";
            }

            return {
                timestamp: timestampMatch ? timestampMatch[1] : "",
                message,
                level,
                levelLabel: level.toUpperCase(),
            };
        },

        setCopyState(state) {
            this.copyState = state;
            clearTimeout(this.copyResetTimeout);
            this.copyResetTimeout = setTimeout(() => {
                this.copyState = "idle";
            }, 2500);
        },

        writeClipboard(text) {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text);
            }

            const textArea = this.$refs.hiddenLogTextarea;
            textArea.value = text;
            textArea.focus();
            textArea.select();

            return new Promise((resolve, reject) => {
                document.execCommand("copy") ? resolve() : reject(new Error("Copy command failed"));
            });
        },

        async loadStatus() {
            this.loading = true;
            const timeoutMs = resolveTwingateStatusBrowserTimeoutMs();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch("/api/twingate/status", {
                    headers: cloudflareWorkerApiHeaders(),
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(await response.text());
                }
                this.status = await response.json();
                this.logsCleared = false;
                this.copyState = "idle";
            } catch (error) {
                const message = error.name === "AbortError"
                    ? `Twingate status request timed out after ${timeoutMs}ms`
                    : error.message;
                this.status = {
                    configured: false,
                    starting: false,
                    running: false,
                    lastError: message,
                };
                this.logsCleared = false;
                this.copyState = "idle";
            } finally {
                clearTimeout(timeout);
                this.loading = false;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.twingate-log-panel {
    --twingate-panel-bg: #f6f8fa;
    --twingate-panel-border: #d8dee4;
    --twingate-panel-header: #ffffff;
    --twingate-panel-text: #24292f;
    --twingate-panel-muted: #57606a;
    --twingate-log-body: #f8fafc;
    --twingate-log-line: #ffffff;
    --twingate-log-hover: rgba(15, 23, 42, 0.05);
    --twingate-log-rule: rgba(15, 23, 42, 0.1);

    overflow: hidden;
    max-width: 100%;
    min-width: 0;
    margin-top: 1rem;
    border: 1px solid var(--twingate-panel-border);
    border-radius: 8px;
    background: var(--twingate-panel-bg);
    color: var(--twingate-panel-text);
    box-shadow: 0 1rem 2rem rgba(15, 23, 42, 0.08);

    .dark & {
        --twingate-panel-bg: #0b111a;
        --twingate-panel-border: #263244;
        --twingate-panel-header: #161b22;
        --twingate-panel-text: #d4dae2;
        --twingate-panel-muted: #9aa4b2;
        --twingate-log-body: #060a12;
        --twingate-log-line: #111827;
        --twingate-log-hover: rgba(255, 255, 255, 0.05);
        --twingate-log-rule: rgba(148, 163, 184, 0.18);
    }
}

.twingate-log-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--twingate-panel-border);
    background: var(--twingate-panel-header);
}

.twingate-log-heading {
    min-width: 0;
}

.twingate-log-title {
    font-size: 1rem;
    font-weight: 700;
}

.twingate-log-summary {
    margin-top: 0.125rem;
    color: var(--twingate-panel-muted);
    font-size: 0.875rem;
}

.twingate-log-count {
    flex: 0 0 auto;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: rgba($primary, 0.16);
    color: #116329;
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;

    .dark & {
        color: $highlight;
    }
}

.twingate-log-actions {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
}

.twingate-log-button {
    min-width: 4.75rem;
    border-radius: $button-border-radius-sm;
}

.twingate-log-list {
    max-height: 32rem;
    overflow: auto;
    margin: 0;
    padding: 0.2rem 0;
    background: var(--twingate-log-body);
    list-style: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.74rem;
    line-height: 1.32;
}

.twingate-log-line {
    --twingate-log-accent: #57606a;
    --twingate-log-soft: rgba(87, 96, 106, 0.12);

    display: grid;
    grid-template-columns: 2.25rem 3.5rem minmax(0, 1fr);
    grid-template-areas: "number level message";
    gap: 0.45rem;
    align-items: start;
    padding: 0.16rem 0.75rem;
    color: var(--twingate-panel-text);

    &:hover {
        background: var(--twingate-log-hover);
    }

    &.is-error {
        --twingate-log-accent: #d92d20;
        --twingate-log-soft: rgba(217, 45, 32, 0.12);

        color: #b42318;
    }

    &.is-warning {
        --twingate-log-accent: #b54708;
        --twingate-log-soft: rgba(181, 71, 8, 0.12);

        color: #9a6700;
    }

    &.is-info {
        --twingate-log-accent: #0969da;
        --twingate-log-soft: rgba(9, 105, 218, 0.12);

        color: #0969da;
    }

    &.is-debug,
    &.is-status {
        color: var(--twingate-panel-muted);
    }

    .dark &.is-error {
        --twingate-log-accent: #ff806f;
        --twingate-log-soft: rgba(255, 128, 111, 0.14);

        color: #ffb4a9;
    }

    .dark &.is-warning {
        --twingate-log-accent: #f0c36a;
        --twingate-log-soft: rgba(240, 195, 106, 0.16);

        color: #f0c36a;
    }

    .dark &.is-info {
        --twingate-log-accent: #8cc2ff;
        --twingate-log-soft: rgba(140, 194, 255, 0.14);

        color: #8cc2ff;
    }

    .dark &.is-debug,
    .dark &.is-status {
        color: $secondary-text;
    }
}

.twingate-log-number {
    grid-area: number;
    color: #6e7781;
    min-width: 0;
    overflow-wrap: anywhere;

    .dark & {
        color: #7d8590;
    }
}

.twingate-log-level {
    grid-area: level;
    justify-self: start;
    min-width: 3.2rem;
    padding: 0.05rem 0.25rem;
    border-radius: 999px;
    background: var(--twingate-log-accent);
    color: #ffffff;
    font-size: 0.62rem;
    font-weight: 700;
    text-align: center;
}

.twingate-log-time {
    grid-area: time;
    display: none;
    color: #6e7781;
    min-width: 0;
    overflow-wrap: anywhere;

    .dark & {
        color: #7d8590;
    }
}

.twingate-log-message {
    grid-area: message;
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.twingate-hidden-copy-field {
    position: fixed;
    top: -999999px;
    left: -999999px;
}

@media (max-width: 767px) {
    .twingate-log-header {
        flex-direction: column;
        padding: 0.9rem;
    }

    .twingate-log-actions {
        width: 100%;
        justify-content: flex-start;
    }

    .twingate-log-line {
        grid-template-columns: 2.3rem minmax(0, 1fr);
        grid-template-areas:
            "number level"
            "number message";
        gap: 0.25rem 0.6rem;
        padding-inline: 0.75rem;
    }

    .twingate-log-time {
        display: none;
    }
}
</style>
