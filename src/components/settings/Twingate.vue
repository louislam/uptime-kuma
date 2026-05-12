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
                    <div>
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
    </div>
</template>

<script>
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

        async copyLogs() {
            try {
                await this.writeClipboard(this.normalizedLogText);
                this.setCopyState("copied");
            } catch (error) {
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
            try {
                const response = await fetch("/api/twingate/status");
                if (!response.ok) {
                    throw new Error(await response.text());
                }
                this.status = await response.json();
                this.logsCleared = false;
                this.copyState = "idle";
            } catch (error) {
                this.status = {
                    configured: false,
                    starting: false,
                    running: false,
                    lastError: error.message,
                };
                this.logsCleared = false;
                this.copyState = "idle";
            } finally {
                this.loading = false;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.twingate-log-panel {
    overflow: hidden;
    margin-top: 1rem;
    border: 1px solid #d8dee4;
    border-radius: 8px;
    background: #f6f8fa;
    color: #24292f;

    .dark & {
        border-color: $dark-border-color;
        background: $dark-bg2;
        color: $dark-font-color;
    }
}

.twingate-log-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid #d8dee4;
    background: #ffffff;

    .dark & {
        border-bottom-color: $dark-border-color;
        background: $dark-header-bg;
    }
}

.twingate-log-title {
    font-weight: 600;
}

.twingate-log-summary {
    margin-top: 0.125rem;
    color: #57606a;
    font-size: 0.875rem;

    .dark & {
        color: $secondary-text;
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
    justify-content: flex-end;
    gap: 0.5rem;
}

.twingate-log-button {
    min-width: 4.75rem;
    border-radius: 999px;
}

.twingate-log-list {
    max-height: 26rem;
    overflow: auto;
    margin: 0;
    padding: 0.4rem 0;
    list-style: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.82rem;
    line-height: 1.45;
}

.twingate-log-line {
    --twingate-log-accent: #57606a;

    display: grid;
    grid-template-columns: 3rem 4.5rem minmax(13rem, max-content) minmax(0, 1fr);
    gap: 0.625rem;
    align-items: start;
    padding: 0.25rem 1rem;

    &:hover {
        background: rgba(0, 0, 0, 0.04);
    }

    .dark &:hover {
        background: rgba(255, 255, 255, 0.04);
    }

    &.is-error {
        --twingate-log-accent: #b42318;

        color: #b42318;
    }

    &.is-warning {
        --twingate-log-accent: #9a6700;

        color: #9a6700;
    }

    &.is-info {
        --twingate-log-accent: #0969da;

        color: #0969da;
    }

    &.is-debug,
    &.is-status {
        color: #57606a;
    }

    .dark &.is-error {
        --twingate-log-accent: #ffb4a9;

        color: #ffb4a9;
    }

    .dark &.is-warning {
        --twingate-log-accent: #f0c36a;

        color: #f0c36a;
    }

    .dark &.is-info {
        --twingate-log-accent: #8cc2ff;

        color: #8cc2ff;
    }

    .dark &.is-debug,
    .dark &.is-status {
        color: $secondary-text;
    }
}

.twingate-log-number,
.twingate-log-time {
    color: #6e7781;

    .dark & {
        color: #7d8590;
    }
}

.twingate-log-level {
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

.twingate-log-message {
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
    }

    .twingate-log-actions {
        justify-content: flex-start;
    }

    .twingate-log-line {
        grid-template-columns: 2.25rem 4.25rem minmax(0, 1fr);
    }

    .twingate-log-time {
        display: none;
    }
}
</style>
