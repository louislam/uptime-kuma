<template>
    <main class="tokenfleet-page">
        <header class="brand-bar">
            <div class="brand-left">
                <div class="brand-logo" aria-label="TokenFleet动态统计">
                    <img class="brand-logo-image" :src="tokenfleetLogo" alt="" aria-hidden="true" />
                    <span>TokenFleet动态统计</span>
                </div>
                <nav class="brand-tabs" aria-label="TokenFleet dashboard tabs">
                    <template v-for="(tab, index) in tabs" :key="tab.value">
                        <button
                            type="button"
                            class="brand-tab"
                            :class="{ active: activeTabIndex === index }"
                            @click="selectTab(index)"
                        >
                            {{ tab.label }}
                        </button>
                        <span v-if="index < tabs.length - 1" class="tab-separator">/</span>
                    </template>
                </nav>
            </div>
            <div class="brand-status">
                <span class="live-dot"></span>
                <span>Live</span>
                <strong>{{ currentFrame.second }}ms</strong>
            </div>
        </header>

        <section class="control-strip" aria-label="Timeline controls">
            <div class="control-copy">
                <span class="phase-label">当前阶段：</span>
                <strong>{{ currentFrame.headline }}</strong>
                <small>· Frame {{ currentFrame.frame }} / {{ timeline.length }} · {{ activeTab.label }}</small>
            </div>
            <div class="control-progress">
                <div class="timeline-track" aria-label="Timeline progress">
                    <div class="timeline-fill" :style="{ width: timelineProgress + '%' }"></div>
                </div>
                <div class="tab-track" aria-label="Tab progress">
                    <div class="tab-fill" :style="{ width: tabProgress + '%' }"></div>
                </div>
            </div>
            <div class="timeline-actions">
                <button class="icon-btn" type="button" aria-label="Previous frame" @click="previousFrame">
                    &larr;
                </button>
                <button class="play-btn" type="button" @click="togglePlayback">
                    {{ isPlaying ? "暂停" : "播放" }}
                </button>
                <button class="icon-btn" type="button" aria-label="Next frame" @click="nextFrame">
                    &rarr;
                </button>
            </div>
        </section>

        <Transition name="tab-fade" mode="out-in">
            <section :key="activeTab.value" class="tab-stage">
                <template v-if="activeTab.value === 'overview'">
                    <div class="overview-layout">
                        <section class="metrics-grid" aria-label="Gateway summary metrics">
                            <article v-for="metric in summaryCards" :key="metric.label" class="metric-card">
                                <span>{{ metric.label }}</span>
                                <strong>{{ metric.value }}</strong>
                                <small>{{ metric.hint }}</small>
                            </article>
                        </section>

                        <section class="event-card">
                            <div class="event-content">
                                <div>
                                    <span class="section-kicker">当前时间轴事件</span>
                                    <h2>{{ currentFrame.headline }}</h2>
                                    <p>{{ currentFrame.narrative }}</p>
                                </div>
                                <span class="event-status">
                                    <span class="live-dot"></span>
                                    Live
                                </span>
                            </div>
                        </section>

                        <section class="intelligence-card compact">
                            <div>
                                <span class="section-kicker">Gateway Intelligence Summary</span>
                                <h2>策略摘要</h2>
                            </div>
                            <p>{{ shortGatewaySummary }}</p>
                        </section>
                    </div>
                </template>

                <template v-else-if="activeTab.value === 'providers'">
                    <section class="tab-panel">
                        <div class="tab-heading">
                            <div>
                                <span class="section-kicker">API状态</span>
                                <h2>API 接入状态</h2>
                            </div>
                            <span class="tab-note">{{ currentFrame.summaryMetrics.providersOnline }} online</span>
                        </div>
                        <div class="provider-grid" aria-label="Provider status cards">
                            <article
                                v-for="provider in currentFrame.providers"
                                :key="provider.id"
                                class="provider-card"
                                :class="'status-' + provider.status"
                            >
                                <div class="provider-card-top">
                                    <div>
                                        <h3>{{ provider.name }}</h3>
                                        <p>{{ provider.company }}</p>
                                    </div>
                                    <span class="status-pill" :class="'status-' + provider.status">
                                        {{ statusLabel(provider.status) }}
                                    </span>
                                </div>
                                <div class="provider-meta">
                                    <span :class="'group-tag group-' + provider.group.toLowerCase()">
                                        {{ provider.group }}
                                    </span>
                                    <span>{{ provider.endpoint }}</span>
                                </div>
                                <div class="provider-stats">
                                    <div>
                                        <span>路由权重</span>
                                        <strong>{{ provider.routeWeight }}%</strong>
                                    </div>
                                    <div>
                                        <span>实际流量</span>
                                        <strong>{{ provider.actualTrafficShare }}%</strong>
                                    </div>
                                    <div>
                                        <span>P50 延迟</span>
                                        <strong>{{ latencyText(provider.latencyP50) }}</strong>
                                    </div>
                                    <div>
                                        <span>错误率</span>
                                        <strong>{{ formatPercent(provider.errorRate) }}</strong>
                                    </div>
                                </div>
                                <div class="progress-line">
                                    <div :style="{ width: provider.routeWeight + '%' }"></div>
                                </div>
                            </article>
                        </div>
                    </section>
                </template>

                <template v-else-if="activeTab.value === 'routing'">
                    <section class="tab-panel">
                        <div class="tab-heading">
                            <div>
                                <span class="section-kicker">多路路由分布</span>
                                <h2>策略权重与实际流量对比</h2>
                            </div>
                            <div class="legend">
                                <span><i class="legend-route"></i>路由权重</span>
                                <span><i class="legend-traffic"></i>实际流量</span>
                            </div>
                        </div>
                        <div class="bar-list wide">
                            <div v-for="provider in currentFrame.providers" :key="provider.id" class="bar-row">
                                <div class="bar-label">
                                    <strong>{{ provider.name }}</strong>
                                    <span>路由权重 {{ provider.routeWeight }}% · 实际流量 {{ provider.actualTrafficShare }}%</span>
                                </div>
                                <div class="dual-bar">
                                    <div class="route-bar" :style="{ width: provider.routeWeight + '%' }"></div>
                                    <div class="traffic-bar" :style="{ width: provider.actualTrafficShare + '%' }"></div>
                                </div>
                            </div>
                        </div>
                    </section>
                </template>

                <template v-else-if="activeTab.value === 'latency'">
                    <section class="tab-panel">
                        <div class="tab-heading">
                            <div>
                                <span class="section-kicker">响应速度排行</span>
                                <h2>按 P50 延迟排序</h2>
                            </div>
                        </div>
                        <div class="latency-table" role="table" aria-label="Latency ranking">
                            <div class="latency-row table-head" role="row">
                                <span>供应商</span>
                                <span>P50 延迟</span>
                                <span>P95 延迟</span>
                                <span>错误率</span>
                                <span>趋势</span>
                            </div>
                            <div v-for="provider in latencyRanking" :key="provider.id" class="latency-row" role="row">
                                <span>
                                    <strong>{{ provider.name }}</strong>
                                    <small>{{ provider.company }}</small>
                                </span>
                                <span>{{ latencyText(provider.latencyP50) }}</span>
                                <span>{{ latencyText(provider.latencyP95) }}</span>
                                <span>{{ formatPercent(provider.errorRate) }}</span>
                                <span>{{ provider.trend }}</span>
                            </div>
                        </div>
                    </section>
                </template>

                <template v-else-if="activeTab.value === 'calibration'">
                    <section class="tab-panel calibration-panel">
                        <div class="tab-heading">
                            <div>
                                <span class="section-kicker">转接校准</span>
                                <h2>实际用量与计价用量校准</h2>
                            </div>
                            <div class="legend">
                                <span><i class="legend-actual"></i>实际用量</span>
                                <span><i class="legend-billed"></i>计价用量</span>
                            </div>
                        </div>
                        <div class="calibration-summary-grid">
                            <article>
                                <span>平均差异率</span>
                                <strong>{{ formatDeltaRate(currentFrame.calibration.averageDeltaRate) }}</strong>
                            </article>
                            <article>
                                <span>最大差异率</span>
                                <strong>{{ formatDeltaRate(currentFrame.calibration.maxDeltaRate) }}</strong>
                            </article>
                            <article>
                                <span>已收敛 API 数</span>
                                <strong>{{ currentFrame.calibration.convergedApis }} / 9</strong>
                            </article>
                            <article>
                                <span>校准周期</span>
                                <strong>{{ currentFrame.calibration.cycle }}</strong>
                            </article>
                        </div>
                        <div class="calibration-list">
                            <div
                                v-for="provider in currentFrame.calibration.providers"
                                :key="provider.id"
                                class="calibration-row"
                            >
                                <div class="calibration-heading">
                                    <strong>{{ provider.name }}</strong>
                                    <span :class="'calibration-status ' + calibrationStatusClass(provider.calibrationStatus)">
                                        校准状态：{{ provider.calibrationStatus }}
                                    </span>
                                </div>
                                <div class="calibration-meta">
                                    <span>实际用量 {{ formatTokens(provider.actualUsage) }}</span>
                                    <span>计价用量 {{ formatTokens(provider.billedUsage) }}</span>
                                    <span>差异率 {{ formatDeltaRate(provider.deltaRate) }}</span>
                                </div>
                                <div class="calibration-bars">
                                    <div class="calibration-bar-row">
                                        <span>实际用量</span>
                                        <div class="calibration-bar">
                                            <div
                                                class="actual-bar"
                                                :style="{ width: calibrationBarWidth(provider, 'actualUsage') + '%' }"
                                            ></div>
                                        </div>
                                    </div>
                                    <div class="calibration-bar-row">
                                        <span>计价用量</span>
                                        <div class="calibration-bar">
                                            <div
                                                class="billed-bar"
                                                :style="{ width: calibrationBarWidth(provider, 'billedUsage') + '%' }"
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </template>

                <template v-else>
                    <section class="incident-layout">
                        <article class="tab-panel incident-panel">
                            <div class="tab-heading">
                                <div>
                                    <span class="section-kicker">异常事件与策略动作</span>
                                    <h2>自动切流、成本守护与恢复记录</h2>
                                </div>
                            </div>
                            <div class="incident-feed">
                                <div
                                    v-for="incident in incidentFeed"
                                    :key="incident.id"
                                    class="incident-item"
                                    :class="[
                                        'incident-' + incident.level,
                                        { fresh: currentIncidentIds.includes(incident.id) },
                                    ]"
                                >
                                    <div class="incident-top">
                                        <strong>{{ incident.title }}</strong>
                                        <span>{{ incident.time }}</span>
                                    </div>
                                    <p>{{ incident.description }}</p>
                                    <div class="incident-meta">
                                        <span>{{ incident.provider }}</span>
                                        <span>{{ incident.action }}</span>
                                    </div>
                                </div>
                            </div>
                        </article>

                        <article class="intelligence-card full">
                            <div>
                                <span class="section-kicker">Gateway Intelligence Summary</span>
                                <h2>完整策略总结</h2>
                            </div>
                            <p>{{ currentFrame.gatewaySummary }}</p>
                        </article>
                    </section>
                </template>
            </section>
        </Transition>
    </main>
</template>

<script>
import { timeline } from "../assets/tokenfleet-gateway-timeline";
import tokenfleetLogo from "../assets/tokenfleet-logo.png";

const FRAME_INTERVAL = 10000;
const TAB_INTERVAL = 3000;

export default {
    data() {
        return {
            timeline,
            tokenfleetLogo,
            currentFrameIndex: 0,
            activeTabIndex: 0,
            isPlaying: true,
            playbackTimer: null,
            tabTimer: null,
            tabStartedAt: Date.now(),
            tabs: [
                { label: "总览", value: "overview" },
                { label: "API状态", value: "providers" },
                { label: "路由分布", value: "routing" },
                { label: "响应速度", value: "latency" },
                { label: "转接校准", value: "calibration" },
                { label: "异常事件", value: "incidents" },
            ],
        };
    },
    computed: {
        currentFrame() {
            return this.timeline[this.currentFrameIndex];
        },
        activeTab() {
            return this.tabs[this.activeTabIndex];
        },
        timelineProgress() {
            return ((this.currentFrameIndex + 1) / this.timeline.length) * 100;
        },
        tabProgress() {
            return ((this.activeTabIndex + 1) / this.tabs.length) * 100;
        },
        summaryCards() {
            const metrics = this.currentFrame.summaryMetrics;
            return [
                { label: "Gateway Health", value: metrics.gatewayHealth, hint: "global policy state" },
                { label: "Providers Online", value: metrics.providersOnline, hint: "active upstreams" },
                { label: "Avg Latency", value: this.latencyText(metrics.avgLatency), hint: "weighted p50" },
                { label: "Requests Today", value: this.formatCompact(metrics.requestsToday), hint: "gateway ingress" },
                { label: "Tokens Today", value: this.formatTokens(metrics.tokensToday), hint: "processed volume" },
                { label: "Active Incidents", value: metrics.activeIncidents, hint: "open events" },
            ];
        },
        latencyRanking() {
            return [...this.currentFrame.providers]
                .filter((provider) => provider.latencyP50 > 0)
                .sort((a, b) => a.latencyP50 - b.latencyP50);
        },
        incidentFeed() {
            return this.timeline
                .slice(0, this.currentFrameIndex + 1)
                .flatMap((frame) => frame.incidents)
                .reverse();
        },
        currentIncidentIds() {
            return this.currentFrame.incidents.map((incident) => incident.id);
        },
        shortGatewaySummary() {
            return this.currentFrame.gatewaySummary.split("。")[0] + "。";
        },
    },
    mounted() {
        this.startPlayback();
    },
    beforeUnmount() {
        this.stopPlayback();
    },
    methods: {
        startPlayback() {
            this.startFramePlayback();
            this.startTabPlayback();
        },
        startFramePlayback() {
            if (this.playbackTimer) {
                clearInterval(this.playbackTimer);
            }
            this.playbackTimer = setInterval(() => {
                if (this.isPlaying) {
                    this.nextFrame();
                }
            }, FRAME_INTERVAL);
        },
        startTabPlayback() {
            if (this.tabTimer) {
                clearInterval(this.tabTimer);
            }
            this.tabStartedAt = Date.now();
            this.tabTimer = setInterval(() => {
                if (this.isPlaying) {
                    this.nextTab();
                }
            }, TAB_INTERVAL);
        },
        stopPlayback() {
            if (this.playbackTimer) {
                clearInterval(this.playbackTimer);
                this.playbackTimer = null;
            }
            if (this.tabTimer) {
                clearInterval(this.tabTimer);
                this.tabTimer = null;
            }
        },
        togglePlayback() {
            this.isPlaying = !this.isPlaying;
            if (this.isPlaying) {
                this.startTabPlayback();
            }
        },
        selectTab(index) {
            this.activeTabIndex = index;
            this.startTabPlayback();
        },
        nextTab() {
            this.activeTabIndex = (this.activeTabIndex + 1) % this.tabs.length;
            this.tabStartedAt = Date.now();
        },
        nextFrame() {
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.timeline.length;
        },
        previousFrame() {
            this.currentFrameIndex =
                (this.currentFrameIndex - 1 + this.timeline.length) % this.timeline.length;
        },
        statusLabel(status) {
            const labels = {
                healthy: "Healthy",
                degraded: "Degraded",
                down: "Down",
                maintenance: "Maintenance",
            };
            return labels[status] || status;
        },
        latencyText(value) {
            return value > 0 ? `${value} ms` : "Paused";
        },
        formatPercent(value) {
            return `${value.toFixed(2)}%`;
        },
        formatDeltaRate(value) {
            return `${value.toFixed(4)}%`;
        },
        formatCurrency(value) {
            return `$${Math.round(value).toLocaleString("en-US")}`;
        },
        formatCompact(value) {
            return new Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
            }).format(value);
        },
        formatTokens(value) {
            if (value >= 1000000000) {
                return `${(value / 1000000000).toFixed(2)}B`;
            }
            if (value >= 1000000) {
                return `${(value / 1000000).toFixed(1)}M`;
            }
            return value.toLocaleString("en-US");
        },
        calibrationBarWidth(provider, field) {
            const maxUsage = Math.max(provider.actualUsage, provider.billedUsage);
            const rawWidth = (provider[field] / maxUsage) * 100;
            const visualGap = Math.max(0.24, Math.min(1.25, provider.deltaRate * 85));
            if (provider[field] === maxUsage) {
                return 100;
            }
            return Math.max(96, 100 - visualGap || rawWidth);
        },
        calibrationStatusClass(status) {
            if (status === "精准同步") {
                return "status-precise";
            }
            if (status === "已收敛") {
                return "status-converged";
            }
            return "status-calibrating";
        },
        share(value, total) {
            if (!total) {
                return 0;
            }
            return Math.max(2, (value / total) * 100);
        },
    },
};
</script>

<style lang="scss" scoped>
.tokenfleet-page {
    display: flex;
    min-height: 100vh;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    color: #152033;
    background:
        radial-gradient(circle at 20% 0%, rgba(47, 145, 225, 0.12), transparent 32%),
        linear-gradient(180deg, #f7fbff 0%, #eef5f8 48%, #f8fafc 100%);
}

.brand-bar,
.control-strip,
.tab-stage,
.event-card,
.tab-panel,
.intelligence-card,
.metric-card,
.provider-card {
    border: 1px solid rgba(137, 155, 178, 0.18);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 18px 50px rgba(46, 72, 104, 0.09);
}

.brand-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 18px;
}

.brand-logo,
.brand-left,
.brand-tabs,
.brand-status,
.event-status,
.timeline-actions,
.tab-heading,
.provider-card-top,
.bar-label,
.calibration-heading,
.calibration-meta,
.incident-top,
.incident-meta,
.legend {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.brand-left {
    min-width: 0;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
    white-space: nowrap;
}

.brand-left::-webkit-scrollbar {
    display: none;
}

.brand-logo {
    flex: 0 0 auto;
    justify-content: flex-start;
    margin-right: 4px;
    color: #101c2d;
    font-size: 22px;
    font-weight: 850;
}

.brand-tabs {
    flex: 0 0 auto;
    justify-content: flex-start;
    gap: 6px;
}

.brand-tab {
    border: 0;
    padding: 0;
    background: transparent;
    color: #7a8aa1;
    cursor: pointer;
    font-size: 14px;
    font-style: italic;
    font-weight: 520;
    line-height: 1.2;
    transition: color 160ms ease;
    white-space: nowrap;
}

.brand-tab:hover {
    color: #4b647f;
}

.brand-tab.active {
    color: #1676c9;
    font-weight: 700;
}

.tab-separator {
    color: #b6c2d0;
    font-style: italic;
}

.brand-logo-image {
    width: 50px;
    height: 34px;
    flex: 0 0 auto;
    object-fit: contain;
}

.brand-status,
.event-status {
    flex: 0 0 auto;
    justify-content: flex-start;
    white-space: nowrap;
    padding: 8px 12px;
    border-radius: 999px;
    color: #0f6b47;
    background: #eaf8f1;
    font-weight: 800;
}

.brand-status strong {
    color: #152033;
}

.live-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #18a66a;
    box-shadow: 0 0 0 5px rgba(24, 166, 106, 0.13);
}

.control-strip {
    display: grid;
    grid-template-columns: minmax(210px, 0.9fr) minmax(260px, 1.6fr) auto;
    align-items: center;
    gap: 18px;
    padding: 14px 16px;
}

.control-copy {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 3px;
    white-space: nowrap;
}

.phase-label {
    color: #66768d;
    font-size: 12px;
    font-weight: 800;
}

.section-kicker {
    display: block;
    margin-bottom: 5px;
    color: #66768d;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
}

.control-copy strong {
    font-size: 15px;
    line-height: 1.35;
}

.control-copy small {
    white-space: nowrap;
}

.control-copy small,
.tab-note {
    color: #728097;
    font-size: 12px;
}

.control-progress {
    display: grid;
    gap: 7px;
}

.timeline-track,
.tab-track,
.dual-bar,
.progress-line {
    overflow: hidden;
    border-radius: 999px;
    background: #e8eef5;
}

.timeline-track {
    height: 9px;
}

.tab-track {
    height: 4px;
}

.timeline-fill,
.tab-fill,
.progress-line div,
.route-bar,
.traffic-bar {
    height: 100%;
    border-radius: inherit;
    transition: width 420ms ease, background-color 420ms ease;
}

.timeline-fill {
    background: linear-gradient(90deg, #16a085, #3b82f6);
}

.tab-fill {
    background: #9fb2c9;
}

.timeline-actions {
    justify-content: flex-end;
}

.icon-btn,
.play-btn {
    border: 1px solid #d8e1eb;
    border-radius: 999px;
    background: #ffffff;
    color: #253247;
    font-weight: 800;
    transition:
        transform 160ms ease,
        border-color 160ms ease,
        background-color 160ms ease;
}

.icon-btn {
    width: 38px;
    height: 38px;
    padding: 0;
}

.play-btn {
    min-width: 76px;
    height: 38px;
}

.icon-btn:hover,
.play-btn:hover {
    border-color: #9fb2c9;
    transform: translateY(-1px);
}

.tab-stage {
    flex: 1;
    min-height: 0;
    padding: 16px;
}

.overview-layout {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 14px;
    height: 100%;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
}

.metric-card {
    padding: 15px;
}

.metric-card span,
.metric-card small {
    display: block;
    color: #748197;
}

.metric-card strong {
    display: block;
    margin: 7px 0 4px;
    font-size: 23px;
    line-height: 1.1;
}

.metric-card small {
    font-size: 12px;
}

.event-card,
.intelligence-card,
.tab-panel {
    padding: 20px;
}

.event-content {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
}

h2,
h3,
p {
    margin-top: 0;
}

h2 {
    margin-bottom: 8px;
    font-size: 21px;
    line-height: 1.25;
}

h3 {
    margin-bottom: 3px;
    font-size: 14px;
    line-height: 1.25;
}

.event-content p,
.intelligence-card p {
    margin-bottom: 0;
    color: #526176;
    line-height: 1.65;
}

.intelligence-card {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
}

.intelligence-card.compact {
    min-height: 112px;
}

.tab-panel {
    height: 100%;
}

.tab-heading {
    margin-bottom: 14px;
}

.legend {
    justify-content: flex-end;
    flex-wrap: wrap;
    color: #66768d;
    font-size: 12px;
    font-weight: 700;
}

.legend i {
    display: inline-block;
    width: 18px;
    height: 8px;
    margin-right: 6px;
    border-radius: 999px;
}

.legend-route {
    background: rgba(31, 122, 224, 0.82);
}

.legend-traffic,
.legend-actual {
    background: #19a974;
}

.legend-billed {
    background: #f2b84b;
}

.provider-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.provider-card {
    position: relative;
    overflow: hidden;
    padding: 14px;
    transition:
        border-color 300ms ease,
        box-shadow 300ms ease,
        transform 300ms ease;
}

.provider-card:hover {
    transform: translateY(-2px);
}

.provider-card::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    content: "";
    transition: background-color 300ms ease;
}

.provider-card.status-healthy::before,
.status-pill.status-healthy,
.progress-line div {
    background: #19a974;
}

.provider-card.status-degraded::before,
.status-pill.status-degraded {
    background: #f2b84b;
}

.provider-card.status-down::before,
.status-pill.status-down {
    background: #e45858;
}

.provider-card.status-maintenance::before,
.status-pill.status-maintenance {
    background: #7c8da6;
}

.provider-card.status-degraded {
    border-color: rgba(242, 184, 75, 0.48);
}

.provider-card.status-maintenance {
    border-color: rgba(124, 141, 166, 0.48);
}

.provider-card-top {
    align-items: flex-start;
}

.provider-card-top p {
    margin-bottom: 0;
    color: #748197;
    font-size: 12px;
}

.status-pill {
    padding: 5px 8px;
    border-radius: 999px;
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
}

.provider-meta {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 9px;
}

.provider-meta span {
    padding: 5px 7px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #596b82;
    font-size: 11px;
}

.group-tag.group-international {
    background: #edf5ff;
    color: #2369b3;
}

.group-tag.group-china {
    background: #edf8f2;
    color: #14734e;
}

.provider-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
    margin-top: 12px;
}

.provider-stats div {
    min-width: 0;
    padding: 8px;
    border-radius: 12px;
    background: #f8fafc;
}

.provider-stats span {
    display: block;
    color: #7a879a;
    font-size: 11px;
}

.provider-stats strong {
    display: block;
    margin-top: 3px;
    font-size: 13px;
}

.progress-line {
    height: 6px;
    margin-top: 10px;
}

.bar-list,
.calibration-list,
.incident-feed {
    display: grid;
    gap: 10px;
}

.bar-list.wide {
    gap: 12px;
}

.bar-label {
    margin-bottom: 7px;
}

.bar-label strong,
.calibration-heading strong {
    font-size: 13px;
}

.bar-label span,
.calibration-heading span,
.calibration-meta,
.incident-top span,
.incident-meta {
    color: #728097;
    font-size: 12px;
}

.dual-bar {
    position: relative;
    height: 10px;
}

.route-bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: rgba(31, 122, 224, 0.82);
}

.traffic-bar {
    position: absolute;
    inset: 0 auto 0 0;
    height: 4px;
    margin: 3px 0;
    background: #19a974;
}

.latency-table {
    display: grid;
    gap: 8px;
}

.latency-row {
    display: grid;
    grid-template-columns: minmax(220px, 1.3fr) repeat(4, minmax(90px, 1fr));
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    border-radius: 14px;
    background: #f8fafc;
    color: #253247;
}

.latency-row.table-head {
    background: #edf4fb;
    color: #66768d;
    font-size: 12px;
    font-weight: 900;
}

.latency-row small {
    display: block;
    margin-top: 2px;
    color: #748197;
    font-size: 11px;
}

.calibration-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
}

.calibration-summary-grid article {
    padding: 12px;
    border-radius: 14px;
    background: #f8fafc;
}

.calibration-summary-grid span {
    display: block;
    color: #728097;
    font-size: 12px;
}

.calibration-summary-grid strong {
    display: block;
    margin-top: 5px;
    color: #253247;
    font-size: 16px;
}

.calibration-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.calibration-row {
    padding: 11px 12px;
    border-radius: 14px;
    background: #f8fafc;
}

.calibration-meta {
    flex-wrap: wrap;
    margin: 6px 0 8px;
}

.calibration-status {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 900;
}

.status-calibrating {
    color: #185fb3;
    background: #eaf3ff;
}

.status-converged {
    color: #14734e;
    background: #edf8f2;
}

.status-precise {
    color: #0f6b47;
    background: #ddf8ec;
}

.calibration-bars {
    display: grid;
    gap: 6px;
}

.calibration-bar-row {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    color: #728097;
    font-size: 11px;
    font-weight: 800;
}

.calibration-bar {
    overflow: hidden;
    height: 8px;
    border-radius: 999px;
    background: #e8eef5;
}

.actual-bar,
.billed-bar {
    height: 100%;
    border-radius: inherit;
    transition: width 420ms ease;
}

.actual-bar {
    background: #19a974;
}

.billed-bar {
    background: #f2b84b;
}

.incident-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: 14px;
    height: 100%;
}

.incident-feed {
    max-height: calc(100vh - 300px);
    overflow: auto;
    padding-right: 4px;
}

.incident-item {
    padding: 12px;
    border: 1px solid #e4ebf3;
    border-radius: 14px;
    background: #ffffff;
    animation: calm-in 260ms ease;
}

.incident-item.fresh {
    border-color: rgba(31, 122, 224, 0.32);
    background: #f4f9ff;
    box-shadow: 0 10px 24px rgba(31, 122, 224, 0.08);
}

.incident-warning {
    border-left: 4px solid #f2b84b;
}

.incident-critical {
    border-left: 4px solid #e45858;
}

.incident-resolved {
    border-left: 4px solid #19a974;
}

.incident-info {
    border-left: 4px solid #1f7ae0;
}

.incident-item p {
    margin: 7px 0;
    color: #536278;
    font-size: 13px;
    line-height: 1.55;
}

.incident-meta {
    align-items: flex-start;
}

.intelligence-card.full {
    display: block;
}

.tab-fade-enter-active,
.tab-fade-leave-active {
    transition:
        opacity 220ms ease,
        transform 220ms ease;
}

.tab-fade-enter-from,
.tab-fade-leave-to {
    opacity: 0;
    transform: translateY(6px);
}

@keyframes calm-in {
    from {
        opacity: 0;
        transform: translateY(5px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 1180px) {
    .metrics-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .provider-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .calibration-list,
    .calibration-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .provider-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .latency-row {
        grid-template-columns: minmax(180px, 1.4fr) repeat(4, minmax(72px, 1fr));
    }
}

@media (max-width: 820px) {
    .tokenfleet-page {
        padding: 14px;
    }

    .control-strip,
    .event-content,
    .tab-heading,
    .intelligence-card,
    .incident-layout {
        display: block;
    }

    .timeline-actions,
    .legend,
    .tab-note {
        margin-top: 12px;
    }

    .brand-left {
        flex: 1;
    }

    .brand-tabs {
        gap: 5px;
    }

    .brand-tab {
        font-size: 13px;
    }

    .control-copy {
        flex-wrap: wrap;
        white-space: normal;
    }

    .control-copy small {
        white-space: normal;
    }

    .metrics-grid,
    .provider-grid,
    .calibration-list,
    .calibration-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tab-stage {
        overflow: auto;
    }

    .latency-table {
        overflow-x: auto;
    }

    .latency-row {
        min-width: 720px;
    }

    .incident-feed {
        max-height: none;
    }
}

@media (max-width: 560px) {
    .metrics-grid,
    .provider-grid,
    .calibration-list,
    .calibration-summary-grid {
        grid-template-columns: 1fr;
    }

    .provider-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
