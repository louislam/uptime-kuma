<template>
    <div v-if="visible" class="shadow-box webhook-pipeline-metrics mb-4 p-4" data-testid="webhook-pipeline-metrics">
        <h3 class="pipeline-title mb-3">Webhook pipeline</h3>
        <p class="pipeline-note text-muted small mb-3">
            HTTP backlog is incoming webhook traffic waiting to be accepted. The message queue shows work already stored
            for delivery.
        </p>

        <div v-if="loading && !metrics.timestamp" class="text-muted small">Loading pipeline metrics…</div>

        <div v-else class="row g-3">
            <div class="col-md-6">
                <div class="metric-card" :class="levelClass(metrics.proxy.recvQLevel)">
                    <div class="metric-label">Incoming HTTP backlog</div>
                    <div class="metric-value">
                        {{ formatNumber(metrics.proxy.recvQ) }}
                    </div>
                    <div class="metric-meta">
                        Active connections: {{ formatNumber(metrics.proxy.establishedConnections) }}
                    </div>
                    <div v-if="metrics.proxy.publisherHealthy === false" class="metric-hint warning-text">
                        Webhook service is slow to respond (high load).
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="metric-card" :class="levelClass(metrics.queue.readyLevel)">
                    <div class="metric-label">Message queue</div>
                    <div class="metric-value">
                        {{ formatNumber(metrics.queue.messagesReady) }}
                        <span class="metric-sub">ready</span>
                    </div>
                    <div class="metric-meta">
                        Unacked: {{ formatNumber(metrics.queue.messagesUnacknowledged) }} · Total:
                        {{ formatNumber(metrics.queue.messageCount) }} · Consumers:
                        {{ formatNumber(metrics.queue.consumerCount) }}
                    </div>
                    <div v-if="!metrics.queue.connected" class="metric-hint warning-text">
                        Queue metrics are temporarily unavailable.
                    </div>
                </div>
            </div>
        </div>

        <div class="pipeline-footer text-muted small mt-3">
            Updated {{ fromNow(metrics.timestamp) }}
            <span v-for="(warning, idx) in displayWarnings" :key="idx" class="warning-text">· {{ warning }}</span>
        </div>
    </div>
</template>

<script>
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const REFRESH_MS = 10000;

export default {
    props: {
        slug: {
            type: String,
            required: true,
        },
    },

    data() {
        return {
            loading: true,
            fetchError: null,
            warnings: [],
            metrics: {
                timestamp: null,
                proxy: { recvQ: null, recvQLevel: "unknown", establishedConnections: null },
                queue: {
                    messagesReady: null,
                    messagesUnacknowledged: null,
                    messageCount: null,
                    consumerCount: null,
                    readyLevel: "unknown",
                    connected: false,
                },
            },
            refreshTimer: null,
        };
    },

    computed: {
        visible() {
            return String(this.slug || "").toLowerCase() === "newstargeted-status";
        },
        displayWarnings() {
            const raw =
                Array.isArray(this.warnings) && this.warnings.length
                    ? this.warnings
                    : this.fetchError
                      ? [this.fetchError]
                      : [];
            return raw.filter((w) => typeof w === "string" && w.trim().length > 0);
        },
    },

    mounted() {
        if (!this.visible) {
            return;
        }
        this.loadMetrics();
        this.refreshTimer = window.setInterval(() => this.loadMetrics(), REFRESH_MS);
    },

    beforeUnmount() {
        if (this.refreshTimer) {
            window.clearInterval(this.refreshTimer);
        }
    },

    methods: {
        async loadMetrics() {
            if (!this.visible) {
                return;
            }

            try {
                const res = await axios.get("/api/status-page/webhook-pipeline", {
                    timeout: 12000,
                });
                this.metrics = res.data;
                this.warnings = Array.isArray(res.data.warnings) ? res.data.warnings : [];
                this.fetchError = null;
            } catch (error) {
                this.fetchError = error.message || "Failed to load pipeline metrics";
                this.warnings = [];
            } finally {
                this.loading = false;
            }
        },

        formatNumber(value) {
            if (value == null || !Number.isFinite(Number(value))) {
                return "—";
            }
            return Number(value).toLocaleString();
        },

        levelClass(level) {
            if (level === "critical") {
                return "level-critical";
            }
            if (level === "warning") {
                return "level-warning";
            }
            if (level === "ok") {
                return "level-ok";
            }
            return "level-unknown";
        },

        fromNow(iso) {
            if (!iso) {
                return "never";
            }
            return dayjs(iso).fromNow();
        },
    },
};
</script>

<style scoped>
.webhook-pipeline-metrics {
    border-radius: 8px;
}

.pipeline-title {
    font-size: 1.1rem;
    margin: 0;
}

.pipeline-note {
    margin-bottom: 0.75rem;
}

.metric-card {
    border: 1px solid rgba(127, 127, 127, 0.25);
    border-radius: 8px;
    padding: 1rem 1.1rem;
    height: 100%;
    background: rgba(127, 127, 127, 0.04);
}

.metric-label {
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.35rem;
}

.queue-name {
    font-weight: 400;
    opacity: 0.85;
}

.metric-value {
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1.2;
}

.metric-sub {
    font-size: 0.95rem;
    font-weight: 500;
    opacity: 0.75;
    margin-left: 0.25rem;
}

.metric-meta {
    font-size: 0.8rem;
    opacity: 0.85;
    margin-top: 0.45rem;
}

.metric-hint {
    font-size: 0.78rem;
    margin-top: 0.5rem;
}

.warning-text {
    color: #e67e22;
}

.level-ok {
    border-left: 4px solid #27ae60;
}

.level-warning {
    border-left: 4px solid #e67e22;
}

.level-critical {
    border-left: 4px solid #e74c3c;
}

.level-unknown {
    border-left: 4px solid #95a5a6;
}

.pipeline-footer {
    font-size: 0.78rem;
}
</style>
