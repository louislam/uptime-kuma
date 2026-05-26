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
            <div v-if="showLogPanel" class="twingate-log-panel" :class="logPanelClass">
                <div class="twingate-log-header">
                    <div class="twingate-log-heading">
                        <div class="twingate-log-title">{{ $t("twingateRecentLog") }}</div>
                        <div class="twingate-log-summary">
                            {{ $t("twingateLogDescription") }}
                        </div>
                    </div>
                    <div class="twingate-log-toolbar">
                        <div class="twingate-log-style-picker" role="group" :aria-label="$t('twingateLogStyleLabel')">
                            <button
                                v-for="style in logStyleOptions"
                                :key="style.id"
                                type="button"
                                class="twingate-log-style-option"
                                :class="{ 'is-active': selectedLogStyle === style.id }"
                                :title="style.description"
                                :aria-pressed="selectedLogStyle === style.id"
                                @click="selectLogStyle(style.id)"
                            >
                                {{ style.label }}
                            </button>
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
    </div>
</template>

<script>
import { cloudflareWorkerApiHeaders } from "../../cloudflare-worker-api";

const DEFAULT_TWINGATE_STATUS_BROWSER_TIMEOUT_MS = 12000;
const TWINGATE_LOG_STYLE_STORAGE_KEY = "uptimeworker:twingate-log-style";
const TWINGATE_LOG_STYLE_IDS = ["console", "timeline", "inspector", "cards", "compact"];

/**
 * Resolve the browser-side timeout for Twingate status checks.
 * @returns {number} Timeout in milliseconds.
 */
function resolveTwingateStatusBrowserTimeoutMs() {
    return DEFAULT_TWINGATE_STATUS_BROWSER_TIMEOUT_MS;
}

export default {
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
            selectedLogStyle: TWINGATE_LOG_STYLE_IDS[0],
        };
    },

    computed: {
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

        logPanelClass() {
            return `is-style-${this.selectedLogStyle}`;
        },

        logStyleOptions() {
            return [
                {
                    id: "console",
                    label: this.$t("twingateLogStyleConsole"),
                    description: this.$t("twingateLogStyleConsoleDescription"),
                },
                {
                    id: "timeline",
                    label: this.$t("twingateLogStyleTimeline"),
                    description: this.$t("twingateLogStyleTimelineDescription"),
                },
                {
                    id: "inspector",
                    label: this.$t("twingateLogStyleInspector"),
                    description: this.$t("twingateLogStyleInspectorDescription"),
                },
                {
                    id: "cards",
                    label: this.$t("twingateLogStyleCards"),
                    description: this.$t("twingateLogStyleCardsDescription"),
                },
                {
                    id: "compact",
                    label: this.$t("twingateLogStyleCompact"),
                    description: this.$t("twingateLogStyleCompactDescription"),
                },
            ];
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

    mounted() {
        this.restoreLogStyle();
        this.loadStatus();
    },

    unmounted() {
        clearTimeout(this.copyResetTimeout);
    },

    methods: {
        clearLogs() {
            this.logsCleared = true;
            this.copyState = "idle";
            clearTimeout(this.copyResetTimeout);
        },

        restoreLogStyle() {
            try {
                const storedStyle = window.localStorage.getItem(TWINGATE_LOG_STYLE_STORAGE_KEY);
                if (TWINGATE_LOG_STYLE_IDS.includes(storedStyle)) {
                    this.selectedLogStyle = storedStyle;
                }
            } catch {
                this.selectedLogStyle = TWINGATE_LOG_STYLE_IDS[0];
            }
        },

        selectLogStyle(styleId) {
            if (!TWINGATE_LOG_STYLE_IDS.includes(styleId)) {
                return;
            }

            this.selectedLogStyle = styleId;
            try {
                window.localStorage.setItem(TWINGATE_LOG_STYLE_STORAGE_KEY, styleId);
            } catch {
                // Ignore localStorage failures; the selected view still applies for this session.
            }
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
    flex-direction: column;
    align-items: flex-start;
    gap: 0.85rem;
    padding: 1rem;
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

.twingate-log-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-width: 0;
}

.twingate-log-style-picker {
    display: flex;
    flex: 1 1 24rem;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-width: 0;
    padding: 0.25rem;
    border: 1px solid var(--twingate-panel-border);
    border-radius: 8px;
    background: rgba(148, 163, 184, 0.08);
}

.twingate-log-style-option {
    min-width: 4.6rem;
    border: 0;
    border-radius: 6px;
    padding: 0.28rem 0.55rem;
    background: transparent;
    color: var(--twingate-panel-muted);
    font-size: 0.76rem;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;

    &:hover,
    &:focus-visible {
        background: var(--twingate-log-hover);
        color: var(--twingate-panel-text);
    }

    &.is-active {
        background: $primary;
        color: #06130b;
        box-shadow: 0 0.35rem 1rem rgba($primary, 0.24);
    }
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
    max-height: 28rem;
    overflow: auto;
    margin: 0;
    padding: 0.45rem 0;
    background: var(--twingate-log-body);
    list-style: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.82rem;
    line-height: 1.45;
}

.twingate-log-line {
    --twingate-log-accent: #57606a;
    --twingate-log-soft: rgba(87, 96, 106, 0.12);

    display: grid;
    grid-template-columns: 3rem 4.5rem minmax(0, 17rem) minmax(0, 1fr);
    grid-template-areas: "number level time message";
    gap: 0.625rem;
    align-items: start;
    padding: 0.25rem 1rem;
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
    min-width: 3.9rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: var(--twingate-log-accent);
    color: #ffffff;
    font-size: 0.68rem;
    font-weight: 700;
    text-align: center;
}

.twingate-log-time {
    grid-area: time;
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

.twingate-log-panel.is-style-console {
    --twingate-log-body: #05070d;
    --twingate-log-hover: rgba(92, 221, 139, 0.08);

    .twingate-log-list {
        color: #d6e4ff;
    }

    .twingate-log-message {
        color: inherit;
    }
}

.twingate-log-panel.is-style-timeline {
    .twingate-log-list {
        padding: 1rem 1rem 1rem 1.2rem;
    }

    .twingate-log-line {
        position: relative;
        grid-template-columns: 3.4rem minmax(0, 1fr);
        grid-template-areas:
            "number level"
            "number time"
            "number message";
        gap: 0.18rem 0.75rem;
        margin-left: 0.45rem;
        padding: 0.7rem 0.85rem 0.7rem 1rem;
        border-left: 1px solid var(--twingate-log-rule);
        border-radius: 0 8px 8px 0;
        background: linear-gradient(90deg, var(--twingate-log-soft), transparent 42%);

        &::before {
            content: "";
            position: absolute;
            top: 0.9rem;
            left: -0.35rem;
            width: 0.65rem;
            height: 0.65rem;
            border: 2px solid var(--twingate-log-body);
            border-radius: 999px;
            background: var(--twingate-log-accent);
        }
    }

    .twingate-log-number {
        font-size: 0.72rem;
        font-weight: 700;
    }

    .twingate-log-message {
        margin-top: 0.25rem;
    }
}

.twingate-log-panel.is-style-inspector {
    --twingate-log-body: #eef3f8;

    .dark & {
        --twingate-log-body: #08101b;
    }

    .twingate-log-line {
        grid-template-columns: 2.75rem 4.2rem minmax(0, 15rem) minmax(0, 1fr);
        gap: 0.5rem;
        padding: 0.55rem 1rem;
        border-bottom: 1px solid var(--twingate-log-rule);
        border-left: 0.35rem solid var(--twingate-log-accent);
        background: var(--twingate-log-line);
    }

    .twingate-log-level {
        background: var(--twingate-log-soft);
        color: var(--twingate-log-accent);
    }
}

.twingate-log-panel.is-style-cards {
    .twingate-log-list {
        display: grid;
        gap: 0.65rem;
        padding: 1rem;
    }

    .twingate-log-line {
        grid-template-columns: 3rem minmax(0, 1fr);
        grid-template-areas:
            "number level"
            "number time"
            "message message";
        gap: 0.25rem 0.75rem;
        padding: 0.75rem;
        border: 1px solid var(--twingate-log-rule);
        border-radius: 8px;
        background:
            linear-gradient(180deg, var(--twingate-log-soft), transparent 62%),
            var(--twingate-log-line);
    }

    .twingate-log-number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.1rem;
        height: 2.1rem;
        border: 1px solid var(--twingate-log-rule);
        border-radius: 999px;
        background: var(--twingate-panel-bg);
        font-weight: 700;
    }

    .twingate-log-message {
        padding-top: 0.35rem;
        border-top: 1px solid var(--twingate-log-rule);
    }
}

.twingate-log-panel.is-style-compact {
    .twingate-log-list {
        max-height: 32rem;
        padding: 0.2rem 0;
        font-size: 0.74rem;
        line-height: 1.32;
    }

    .twingate-log-line {
        grid-template-columns: 2.25rem 3.5rem minmax(0, 1fr);
        grid-template-areas: "number level message";
        gap: 0.45rem;
        padding: 0.16rem 0.75rem;
    }

    .twingate-log-time {
        display: none;
    }

    .twingate-log-level {
        min-width: 3.2rem;
        padding-inline: 0.25rem;
        font-size: 0.62rem;
    }
}

.twingate-hidden-copy-field {
    position: fixed;
    top: -999999px;
    left: -999999px;
}

@media (max-width: 767px) {
    .twingate-log-header {
        padding: 0.9rem;
    }

    .twingate-log-toolbar {
        align-items: stretch;
        flex-direction: column;
    }

    .twingate-log-style-picker {
        flex: 1 1 auto;
        width: 100%;
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

    .twingate-log-panel.is-style-timeline,
    .twingate-log-panel.is-style-cards,
    .twingate-log-panel.is-style-compact {
        .twingate-log-line {
            grid-template-columns: 2.3rem minmax(0, 1fr);
            grid-template-areas:
                "number level"
                "number message";
        }
    }
}
</style>
