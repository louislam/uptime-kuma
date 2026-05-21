<template>
    <main class="tokenfleet-page">
        <header class="brand-bar">
            <div class="brand-left">
                <div class="brand-logo" aria-label="TokenFleet - 数据中台">
                    <img class="brand-logo-image" :src="tokenfleetLogo" alt="" aria-hidden="true" />
                    <span>TokenFleet - 数据中台</span>
                </div>
                <nav class="brand-tabs" aria-label="TokenFleet 数据中台模块导航">
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
            <div class="brand-right">
                <span class="stage-hint">{{ shortStageHint }}</span>
                <div class="brand-status">
                    <span class="live-dot"></span>
                    <span>实时</span>
                    <strong>{{ currentFrame.second }}ms</strong>
                </div>
            </div>
        </header>

        <Transition name="tab-fade" mode="out-in">
            <section :key="activeTab.value" class="tab-stage">
                <template v-if="activeTab.value === 'overview'">
                    <div class="overview-layout">
                        <section class="metrics-grid" aria-label="网关总览指标">
                            <article v-for="metric in summaryCards" :key="metric.label" class="metric-card">
                                <span>{{ metric.label }}</span>
                                <strong>{{ metric.value }}</strong>
                                <small>{{ metric.hint }}</small>
                            </article>
                        </section>

                        <div class="overview-main">
                            <section class="health-hero-card">
                                <div class="health-chart-header">
                                    <div>
                                        <span class="section-kicker">网关健康趋势</span>
                                        <h2>高可用指标</h2>
                                        <small>最近 8 小时 · 分钟级采样</small>
                                    </div>
                                    <div class="health-value-stack">
                                        <strong>{{ currentHealthValue }}</strong>
                                        <span>{{ gatewayHealthLabel(currentFrame.summaryMetrics.gatewayHealth) }}</span>
                                    </div>
                                </div>
                                <svg class="health-chart" viewBox="0 0 680 320" preserveAspectRatio="none" aria-label="高可用指标">
                                    <defs>
                                        <linearGradient id="healthGradient" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stop-color="#1f7ae0" stop-opacity="0.24" />
                                            <stop offset="100%" stop-color="#2fb5c8" stop-opacity="0.03" />
                                        </linearGradient>
                                    </defs>
                                    <g class="chart-grid-lines">
                                        <line
                                            v-for="tick in healthYAxisTicks"
                                            :key="'y-' + tick.label"
                                            x1="58"
                                            x2="642"
                                            :y1="tick.y"
                                            :y2="tick.y"
                                        />
                                        <line
                                            v-for="tick in healthXAxisTicks"
                                            :key="'x-' + tick.label"
                                            :x1="tick.x"
                                            :x2="tick.x"
                                            y1="34"
                                            y2="250"
                                        />
                                    </g>
                                    <g class="chart-axis-labels">
                                        <text
                                            v-for="tick in healthYAxisTicks"
                                            :key="'yl-' + tick.label"
                                            x="50"
                                            :y="tick.y + 4"
                                            text-anchor="end"
                                        >
                                            {{ tick.label }}
                                        </text>
                                        <text
                                            v-for="tick in healthXAxisTicks"
                                            :key="'xl-' + tick.label"
                                            :x="tick.x"
                                            y="284"
                                            text-anchor="middle"
                                        >
                                            {{ tick.label }}
                                        </text>
                                    </g>
                                    <polygon class="health-area" :points="healthAreaPoints" />
                                    <polyline class="health-hero-line" :points="healthChartPoints" />
                                    <circle
                                        class="health-current-dot"
                                        :cx="healthCurrentPoint.x"
                                        :cy="healthCurrentPoint.y"
                                        r="6"
                                    />
                                    <text
                                        class="health-current-label"
                                        :x="healthCurrentPoint.labelX"
                                        :y="healthCurrentPoint.y - 14"
                                        :text-anchor="healthCurrentPoint.labelAnchor"
                                    >
                                        {{ currentHealthValue }}
                                    </text>
                                    <text
                                        class="health-current-time"
                                        :x="healthCurrentPoint.labelX"
                                        :y="healthCurrentPoint.y + 24"
                                        :text-anchor="healthCurrentPoint.labelAnchor"
                                    >
                                        {{ currentHealthPoint.time }}
                                    </text>
                                </svg>
                            </section>

                            <aside class="overview-copy-stack">
                                <section class="event-card">
                                    <div class="event-content">
                                        <div>
                                            <span class="section-kicker">当前时间轴事件</span>
                                            <h2>{{ currentFrame.headline }}</h2>
                                            <p>{{ currentFrame.narrative }}</p>
                                        </div>
                                        <span class="event-status">
                                            <span class="live-dot"></span>
                                            实时
                                        </span>
                                    </div>
                                </section>

                                <section class="intelligence-card compact">
                                    <div>
                                        <span class="section-kicker">网关智能摘要</span>
                                        <h2>策略摘要</h2>
                                    </div>
                                    <p>{{ shortGatewaySummary }}</p>
                                </section>
                            </aside>
                        </div>
                    </div>
                </template>

                <template v-else-if="activeTab.value === 'providers'">
                    <section class="tab-panel">
                        <div class="tab-heading">
                            <div>
                                <span class="section-kicker">API状态</span>
                                <h2>API 接入状态</h2>
                            </div>
                            <span class="tab-note">{{ currentFrame.summaryMetrics.providersOnline }} 在线</span>
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
                                <span class="section-kicker">路由调度</span>
                                <h2>策略权重、实际流量与自动切流</h2>
                            </div>
                            <div class="legend">
                                <span><i class="legend-route"></i>路由权重</span>
                                <span><i class="legend-traffic"></i>实际流量</span>
                            </div>
                        </div>
                        <div class="routing-dashboard">
                            <section class="chart-card wide-card">
                                <div class="chart-title">
                                    <span class="section-kicker">路由权重变化趋势</span>
                                    <strong>堆叠面积趋势图</strong>
                                </div>
                                <svg class="area-chart" viewBox="0 0 320 120" preserveAspectRatio="none" aria-label="Routing weight trend">
                                    <polygon class="area-openai" :points="stackedPolygon('openai')" />
                                    <polygon class="area-claude" :points="stackedPolygon('claude')" />
                                    <polygon class="area-gemini" :points="stackedPolygon('gemini')" />
                                    <polygon class="area-china" :points="stackedPolygon('chinaPool')" />
                                    <polygon class="area-other" :points="stackedPolygon('other')" />
                                </svg>
                                <div class="routing-action">{{ currentRoutingSnapshot.action }}</div>
                            </section>

                            <section class="chart-card pie-card">
                                <div class="chart-title">
                                    <span class="section-kicker">当前路由占比</span>
                                    <strong>模型池分配</strong>
                                </div>
                                <div class="pie-chart" :style="routingPieStyle">
                                    <span>{{ currentRoutingSnapshot.chinaPool }}%</span>
                                </div>
                                <div class="pie-legend">
                                    <span><i class="area-openai-dot"></i>OpenAI {{ currentRoutingSnapshot.openai }}%</span>
                                    <span><i class="area-claude-dot"></i>Claude {{ currentRoutingSnapshot.claude }}%</span>
                                    <span><i class="area-gemini-dot"></i>Gemini {{ currentRoutingSnapshot.gemini }}%</span>
                                    <span><i class="area-china-dot"></i>China Pool {{ currentRoutingSnapshot.chinaPool }}%</span>
                                </div>
                            </section>

                            <section class="chart-card wide-card">
                                <div class="bar-list wide compact-bars">
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
                        </div>
                    </section>
                </template>

                <template v-else-if="activeTab.value === 'agent'">
                    <section class="tab-panel agent-panel">
                        <div class="tab-heading">
                            <div>
                                <span class="section-kicker">Agent调度</span>
                                <h2>工作流节点、任务优先级与模型池调度</h2>
                            </div>
                        </div>
                        <div class="agent-metrics-grid">
                            <article>
                                <span>Active Agents</span>
                                <strong>{{ currentFrame.agentMetrics.activeAgents }}</strong>
                            </article>
                            <article>
                                <span>Running Workflows</span>
                                <strong>{{ currentFrame.agentMetrics.runningWorkflows }}</strong>
                            </article>
                            <article>
                                <span>Queued Tasks</span>
                                <strong>{{ currentFrame.agentMetrics.queuedTasks }}</strong>
                            </article>
                            <article>
                                <span>SLA Met Rate</span>
                                <strong>{{ currentFrame.agentMetrics.slaMetRate }}%</strong>
                            </article>
                            <article>
                                <span>Cost Saved Today</span>
                                <strong>{{ formatCurrency(currentFrame.agentMetrics.costSavedToday) }}</strong>
                            </article>
                        </div>

                        <div class="agent-dashboard">
                            <section class="chart-card workflow-card">
                                <div class="chart-title">
                                    <span class="section-kicker">Agent 工作流流向</span>
                                    <strong>节点到模型池</strong>
                                </div>
                                <div class="workflow-flow">
                                    <div
                                        v-for="step in currentFrame.workflowRouting"
                                        :key="step.node"
                                        class="workflow-step"
                                    >
                                        <div>
                                            <strong>{{ step.node }}</strong>
                                            <span>{{ step.target }}</span>
                                        </div>
                                        <i></i>
                                        <div>
                                            <strong>{{ step.modelPool }}</strong>
                                            <span>{{ step.reason }}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section class="chart-card">
                                <div class="chart-title">
                                    <span class="section-kicker">任务优先级</span>
                                    <strong>队列柱状图</strong>
                                </div>
                                <div class="priority-bars">
                                    <div v-for="item in agentPriorityBars" :key="item.label" class="priority-row">
                                        <span>{{ item.label }}</span>
                                        <div class="priority-track">
                                            <div :style="{ width: item.width }"></div>
                                        </div>
                                        <strong>{{ item.value }}</strong>
                                    </div>
                                </div>
                            </section>

                            <section class="chart-card strategy-card">
                                <div class="chart-title">
                                    <span class="section-kicker">当前调度策略栈</span>
                                    <strong>Routing Policy Stack</strong>
                                </div>
                                <div class="strategy-stack">
                                    <span v-for="strategy in currentFrame.agentMetrics.strategyStack" :key="strategy">
                                        {{ strategy }}
                                    </span>
                                </div>
                                <p>
                                    当前吞吐 {{ formatNumber(currentFrame.agentMetrics.throughput) }} tasks/min，
                                    根据成本、延迟、质量、稳定性、中文能力与长上下文能力动态选择模型池。
                                </p>
                            </section>
                        </div>
                    </section>
                </template>

                <template v-else-if="activeTab.value === 'metering'">
                    <section class="tab-panel calibration-panel">
                        <div class="tab-heading">
                            <div>
                                <span class="section-kicker">可信计量</span>
                                <h2>实际用量、计价用量与可信计费评分</h2>
                            </div>
                            <div class="legend">
                                <span><i class="legend-actual"></i>实际用量</span>
                                <span><i class="legend-billed"></i>计价用量</span>
                            </div>
                        </div>

                        <div class="trust-summary-grid">
                            <article>
                                <span>可信计费评分</span>
                                <strong>{{ currentFrame.billingMetrics.fairBillingScore }}%</strong>
                            </article>
                            <article>
                                <span>平均差异率</span>
                                <strong>{{ formatDeltaRate(currentFrame.calibration.averageDeltaRate) }}</strong>
                            </article>
                            <article>
                                <span>失败请求免计</span>
                                <strong>{{ formatNumber(currentFrame.billingMetrics.failedRequestsFree) }}</strong>
                            </article>
                            <article>
                                <span>重试请求去重</span>
                                <strong>{{ formatNumber(currentFrame.billingMetrics.retryDeduped) }}</strong>
                            </article>
                            <article>
                                <span>供应商账单对账</span>
                                <strong>{{ currentFrame.billingMetrics.reconciledBills }} / 9</strong>
                            </article>
                        </div>

                        <div class="metering-dashboard">
                            <section class="chart-card wide-card">
                                <div class="chart-title">
                                    <span class="section-kicker">实际用量 vs 计价用量</span>
                                    <strong>双曲线贴合趋势</strong>
                                </div>
                                <svg class="line-chart dual-line-chart" viewBox="0 0 320 112" preserveAspectRatio="none" aria-label="Actual and billed usage trend">
                                    <polyline class="chart-line actual-line" :points="linePoints(currentFrame.calibrationSeries, 'actualUsage', 320, 112, 100, 180)" />
                                    <polyline class="chart-line billed-line" :points="linePoints(currentFrame.calibrationSeries, 'billedUsage', 320, 112, 100, 180)" />
                                </svg>
                            </section>

                            <section class="chart-card">
                                <div class="chart-title">
                                    <span class="section-kicker">差异率收敛曲线</span>
                                    <strong>{{ formatDeltaRate(currentFrame.calibration.averageDeltaRate) }}</strong>
                                </div>
                                <svg class="line-chart" viewBox="0 0 320 112" preserveAspectRatio="none" aria-label="Delta convergence trend">
                                    <polyline class="chart-line delta-line" :points="linePoints(currentFrame.calibrationSeries, 'deltaRate')" />
                                </svg>
                            </section>

                            <section class="chart-card">
                                <div class="chart-title">
                                    <span class="section-kicker">失败免计柱状图</span>
                                    <strong>不成功不乱计</strong>
                                </div>
                                <div class="fairness-bars">
                                    <div v-for="event in currentFrame.fairnessEvents" :key="event.label" class="fairness-row">
                                        <span>{{ event.label }}</span>
                                        <div class="fairness-track">
                                            <div :class="'tone-' + event.tone" :style="{ width: share(event.value, currentFrame.billingMetrics.failedRequestsFree) + '%' }"></div>
                                        </div>
                                        <strong>{{ formatNumber(event.value) }}</strong>
                                    </div>
                                </div>
                            </section>

                            <section class="chart-card pie-pair-card">
                                <div class="chart-title">
                                    <span class="section-kicker">Token 与成本占比</span>
                                    <strong>供应商结构</strong>
                                </div>
                                <div class="pie-pair">
                                    <div>
                                        <div class="pie-chart small" :style="tokenPieStyle"><span>Token</span></div>
                                        <small>Token 占比</small>
                                    </div>
                                    <div>
                                        <div class="pie-chart small" :style="costPieStyle"><span>Cost</span></div>
                                        <small>成本占比</small>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div class="reconciliation-list">
                            <div
                                v-for="provider in currentFrame.calibration.providers"
                                :key="provider.id"
                                class="reconciliation-row"
                            >
                                <strong>{{ provider.name }}</strong>
                                <span>实际 {{ formatTokens(provider.actualUsage) }}</span>
                                <span>计价 {{ formatTokens(provider.billedUsage) }}</span>
                                <span>差异率 {{ formatDeltaRate(provider.deltaRate) }}</span>
                                <em :class="'calibration-status ' + calibrationStatusClass(provider.calibrationStatus)">
                                    {{ provider.calibrationStatus }}
                                </em>
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
                                <span class="section-kicker">网关智能摘要</span>
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
            manualPauseTimer: null,
            tabStartedAt: Date.now(),
            chartNow: new Date(),
            tabs: [
                { label: "总览", value: "overview" },
                { label: "API状态", value: "providers" },
                { label: "路由调度", value: "routing" },
                { label: "Agent调度", value: "agent" },
                { label: "可信计量", value: "metering" },
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
        shortStageHint() {
            const source = this.currentFrame.headline || this.currentFrame.narrative || "";
            const compactText = Array.from(source.replace(/\s+/g, ""));
            if (compactText.length <= 20) {
                return compactText.join("");
            }
            return `${compactText.slice(0, 17).join("")}...`;
        },
        summaryCards() {
            const metrics = this.currentFrame.summaryMetrics;
            const billing = this.currentFrame.billingMetrics;
            const agent = this.currentFrame.agentMetrics;
            return [
                { label: "网关健康状态", value: this.gatewayHealthLabel(metrics.gatewayHealth), hint: "全局策略状态" },
                { label: "在线供应商", value: metrics.providersOnline, hint: "在线上游" },
                { label: "平均延迟", value: this.latencyText(metrics.avgLatency), hint: "加权 P50" },
                { label: "今日请求量", value: this.formatCompact(metrics.requestsToday), hint: "网关入口" },
                { label: "今日 Token", value: this.formatTokens(metrics.tokensToday), hint: "已处理用量" },
                { label: "活跃异常", value: metrics.activeIncidents, hint: "未关闭事件" },
                { label: "可信计费评分", value: `${billing.fairBillingScore}%`, hint: "可信计量" },
                { label: "路由效率", value: `${agent.routingEfficiency}%`, hint: "策略匹配度" },
                { label: "Agent SLA 达成率", value: `${agent.slaMetRate}%`, hint: "工作流目标" },
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
        fullAvailabilitySeries() {
            const pointCount = this.timeline.length;
            return this.timeline.map((frame, index) => {
                const offsetMinutes = -480 + index * (480 / (pointCount - 1));
                const timestamp = new Date(this.chartNow.getTime() + offsetMinutes * 60000);
                return {
                    timestamp,
                    time: this.formatTime(timestamp),
                    offsetMinutes,
                    value: frame.billingMetrics.fairBillingScore,
                };
            });
        },
        visibleAvailabilitySeries() {
            return this.fullAvailabilitySeries.slice(0, this.currentFrameIndex + 1);
        },
        healthYAxisTicks() {
            return [99.9, 99.95, 99.98, 99.99, 100].map((value) => ({
                label: `${value.toFixed(2)}%`,
                y: this.healthChartY(value),
            }));
        },
        healthXAxisTicks() {
            return Array.from({ length: 9 }, (_, index) => {
                const offsetMinutes = -480 + index * 60;
                const timestamp = new Date(this.chartNow.getTime() + offsetMinutes * 60000);
                return {
                    label: this.formatTime(timestamp),
                    x: this.healthChartXByOffset(offsetMinutes),
                };
            });
        },
        healthChartPoints() {
            return this.visibleAvailabilitySeries.map((item) => (
                `${this.healthChartXByOffset(item.offsetMinutes).toFixed(1)},${this.healthChartY(item.value).toFixed(1)}`
            )).join(" ");
        },
        healthAreaPoints() {
            const baseline = 250;
            const points = this.visibleAvailabilitySeries.map((item) => (
                `${this.healthChartXByOffset(item.offsetMinutes).toFixed(1)},${this.healthChartY(item.value).toFixed(1)}`
            ));
            const lastPoint = this.visibleAvailabilitySeries[this.visibleAvailabilitySeries.length - 1];
            const lastX = this.healthChartXByOffset(lastPoint.offsetMinutes).toFixed(1);
            return [`58,${baseline}`, ...points, `${lastX},${baseline}`].join(" ");
        },
        healthCurrentPoint() {
            const item = this.currentHealthPoint;
            const x = this.healthChartXByOffset(item.offsetMinutes);
            const labelAnchor = x > 585 ? "end" : "start";
            const labelX = x > 585 ? x - 12 : x + 12;
            return {
                x,
                y: this.healthChartY(item.value),
                labelX,
                labelAnchor,
            };
        },
        currentHealthPoint() {
            return this.visibleAvailabilitySeries[this.visibleAvailabilitySeries.length - 1];
        },
        currentHealthValue() {
            return `${this.currentHealthPoint.value}%`;
        },
        currentRoutingSnapshot() {
            return this.currentFrame.routingSeries[this.currentFrame.routingSeries.length - 1];
        },
        routingPieStyle() {
            return this.pieStyle([
                { value: this.currentRoutingSnapshot.openai, color: "#1f7ae0" },
                { value: this.currentRoutingSnapshot.claude, color: "#7c5cff" },
                { value: this.currentRoutingSnapshot.gemini, color: "#2fb5c8" },
                { value: this.currentRoutingSnapshot.chinaPool, color: "#19a974" },
                { value: this.currentRoutingSnapshot.other, color: "#9fb2c9" },
            ]);
        },
        tokenPieStyle() {
            return this.pieStyle(this.currentFrame.providers.map((provider, index) => ({
                value: provider.tokensToday,
                color: this.providerColors[index % this.providerColors.length],
            })));
        },
        costPieStyle() {
            return this.pieStyle(this.currentFrame.providers.map((provider, index) => ({
                value: provider.costToday,
                color: this.providerColors[index % this.providerColors.length],
            })));
        },
        agentPriorityBars() {
            const priority = this.currentFrame.agentMetrics.priority;
            const maxValue = Math.max(...Object.values(priority));
            return Object.entries(priority).map(([label, value]) => ({
                label,
                value,
                width: `${(value / maxValue) * 100}%`,
            }));
        },
        providerColors() {
            return ["#1f7ae0", "#7c5cff", "#2fb5c8", "#19a974", "#f2b84b", "#5b8def", "#7ac7a5", "#9fb2c9", "#42526e"];
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
            if (this.manualPauseTimer) {
                clearTimeout(this.manualPauseTimer);
                this.manualPauseTimer = null;
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
            this.pauseAutoPlayForReview();
        },
        pauseAutoPlayForReview() {
            this.isPlaying = false;
            if (this.playbackTimer) {
                clearInterval(this.playbackTimer);
                this.playbackTimer = null;
            }
            if (this.tabTimer) {
                clearInterval(this.tabTimer);
                this.tabTimer = null;
            }
            if (this.manualPauseTimer) {
                clearTimeout(this.manualPauseTimer);
            }
            this.manualPauseTimer = setTimeout(() => {
                this.isPlaying = true;
                this.manualPauseTimer = null;
                this.startPlayback();
            }, FRAME_INTERVAL);
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
        gatewayHealthLabel(status) {
            const labels = {
                Healthy: "健康",
                Degraded: "降级",
                Recovering: "恢复中",
                Down: "不可用",
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
        formatNumber(value) {
            return value.toLocaleString("en-US");
        },
        formatTime(date) {
            return date.toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
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
        linePoints(series, field, width = 320, height = 112, minOverride = null, maxOverride = null) {
            if (!series.length) {
                return "";
            }
            const values = series.map((item) => item[field]);
            const minValue = minOverride ?? Math.min(...values);
            const maxValue = maxOverride ?? Math.max(...values);
            const range = maxValue - minValue || 1;
            return series.map((item, index) => {
                const x = series.length === 1 ? width : (index / (series.length - 1)) * width;
                const y = height - ((item[field] - minValue) / range) * height;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ");
        },
        stackedPolygon(key) {
            const series = this.currentFrame.routingSeries;
            const keys = ["openai", "claude", "gemini", "chinaPool", "other"];
            const keyIndex = keys.indexOf(key);
            const width = 320;
            const height = 120;
            const topPoints = [];
            const bottomPoints = [];
            series.forEach((item, index) => {
                const x = series.length === 1 ? width : (index / (series.length - 1)) * width;
                const before = keys.slice(0, keyIndex).reduce((sum, itemKey) => sum + item[itemKey], 0);
                const current = before + item[key];
                topPoints.push(`${x.toFixed(1)},${(height - current / 100 * height).toFixed(1)}`);
                bottomPoints.unshift(`${x.toFixed(1)},${(height - before / 100 * height).toFixed(1)}`);
            });
            return [...topPoints, ...bottomPoints].join(" ");
        },
        pieStyle(items) {
            const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
            let cursor = 0;
            const stops = items.map((item) => {
                const start = cursor;
                cursor += (item.value / total) * 100;
                return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
            });
            return { background: `conic-gradient(${stops.join(", ")})` };
        },
        healthChartXByOffset(offsetMinutes) {
            return 58 + ((offsetMinutes + 480) / 480) * 584;
        },
        healthChartY(value) {
            const minValue = 99.9;
            const maxValue = 100;
            return 250 - ((value - minValue) / (maxValue - minValue)) * 216;
        },
    },
};
</script>

<style lang="scss" scoped>
.tokenfleet-page {
    display: flex;
    min-height: 100vh;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    color: #152033;
    background:
        radial-gradient(circle at 20% 0%, rgba(47, 145, 225, 0.12), transparent 32%),
        linear-gradient(180deg, #f7fbff 0%, #eef5f8 48%, #f8fafc 100%);
}

.brand-bar,
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
.brand-right,
.event-status,
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
    position: relative;
    border: 0;
    padding: 0 0 5px;
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

.brand-tab.active::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, #1f7ae0, #2fb5c8);
    content: "";
}

.tab-separator {
    padding-bottom: 5px;
    color: #b6c2d0;
    font-style: italic;
}

.brand-logo-image {
    width: 50px;
    height: 34px;
    flex: 0 0 auto;
    object-fit: contain;
}

.brand-right {
    flex: 0 0 auto;
    justify-content: flex-end;
}

.stage-hint {
    max-width: 190px;
    overflow: hidden;
    color: #6b7f97;
    font-size: 12px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
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

.section-kicker {
    display: block;
    margin-bottom: 5px;
    color: #66768d;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
}

.tab-note {
    color: #728097;
    font-size: 12px;
}

.dual-bar,
.progress-line {
    overflow: hidden;
    border-radius: 999px;
    background: #e8eef5;
}

.progress-line div,
.route-bar,
.traffic-bar {
    height: 100%;
    border-radius: inherit;
    transition: width 420ms ease, background-color 420ms ease;
}

.tab-stage {
    flex: 1;
    min-height: 0;
    padding: 16px;
}

.overview-layout {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 14px;
    height: 100%;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(9, minmax(0, 1fr));
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

.overview-main {
    display: grid;
    grid-template-columns: minmax(0, 2.25fr) minmax(320px, 0.85fr);
    gap: 14px;
    align-items: stretch;
    min-height: 0;
}

.overview-copy-stack {
    display: grid;
    grid-template-rows: auto auto;
    align-content: start;
    gap: 14px;
    min-height: 0;
}

.overview-copy-stack .event-card,
.overview-copy-stack .intelligence-card {
    padding: 18px;
}

.overview-copy-stack .event-content {
    display: grid;
    gap: 12px;
}

.overview-copy-stack .event-status {
    justify-self: start;
    padding: 6px 10px;
    font-size: 12px;
}

.overview-copy-stack h2 {
    font-size: 18px;
}

.overview-copy-stack p {
    font-size: 13px;
    line-height: 1.6;
}

.overview-copy-stack .intelligence-card {
    display: block;
}

.overview-copy-stack .intelligence-card p {
    overflow: hidden;
    max-height: 11.2em;
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

.mini-chart-card,
.health-hero-card,
.chart-card {
    border: 1px solid #e3ebf4;
    border-radius: 16px;
    background: #ffffff;
}

.mini-chart-card {
    padding: 14px;
}

.chart-card {
    min-width: 0;
    padding: 14px;
    background: #f9fbfe;
}

.health-hero-card {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 460px;
    padding: 20px 22px 16px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.98)),
        radial-gradient(circle at 74% 10%, rgba(47, 181, 200, 0.12), transparent 36%);
}

.health-chart-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
}

.health-chart-header h2 {
    margin-bottom: 0;
}

.health-chart-header small {
    display: block;
    margin-top: 5px;
    color: #728097;
    font-size: 12px;
    font-weight: 800;
}

.health-value-stack {
    display: grid;
    justify-items: end;
    gap: 6px;
}

.health-value-stack strong {
    padding: 8px 12px;
    border-radius: 999px;
    color: #1269c6;
    background: #eaf5ff;
    font-size: 18px;
}

.health-value-stack span {
    padding: 5px 9px;
    border-radius: 999px;
    color: #245f93;
    background: #edf7ff;
    font-size: 12px;
    font-weight: 900;
}

.health-chart {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 390px;
}

.chart-grid-lines line {
    stroke: rgba(126, 148, 174, 0.22);
    stroke-width: 1;
}

.chart-axis-labels text {
    fill: #7a879a;
    font-size: 11px;
    font-weight: 700;
}

.health-area {
    fill: url("#healthGradient");
}

.health-hero-line {
    fill: none;
    stroke: #1f7ae0;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 4.4;
    filter: drop-shadow(0 8px 12px rgba(31, 122, 224, 0.18));
}

.health-current-dot {
    fill: #ffffff;
    stroke: #1f7ae0;
    stroke-width: 4;
}

.health-current-label {
    fill: #1269c6;
    font-size: 13px;
    font-weight: 900;
}

.health-current-time {
    fill: #728097;
    font-size: 11px;
    font-weight: 800;
}

.chart-title {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}

.chart-title strong {
    color: #253247;
    font-size: 13px;
}

.line-chart,
.area-chart {
    display: block;
    width: 100%;
    height: 122px;
    overflow: visible;
}

.line-chart {
    border-radius: 14px;
    background:
        linear-gradient(#eef4fa 1px, transparent 1px) 0 0 / 100% 28px,
        linear-gradient(90deg, #eef4fa 1px, transparent 1px) 0 0 / 64px 100%;
}

.chart-line {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 3.2;
    transition: points 420ms ease;
}

.health-line {
    stroke: #1f7ae0;
}

.actual-line {
    stroke: #19a974;
}

.billed-line {
    stroke: #f2b84b;
}

.delta-line {
    stroke: #2f91e1;
}

.area-chart {
    border-radius: 14px;
    background: #eef5fb;
}

.area-chart polygon {
    transition: points 420ms ease, opacity 420ms ease;
}

.area-openai {
    fill: rgba(31, 122, 224, 0.82);
}

.area-claude {
    fill: rgba(124, 92, 255, 0.74);
}

.area-gemini {
    fill: rgba(47, 181, 200, 0.72);
}

.area-china {
    fill: rgba(25, 169, 116, 0.78);
}

.area-other {
    fill: rgba(159, 178, 201, 0.82);
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

.routing-dashboard,
.agent-dashboard,
.metering-dashboard {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
    gap: 12px;
}

.wide-card,
.workflow-card {
    grid-column: span 1;
}

.compact-bars {
    max-height: 272px;
    overflow: auto;
    padding-right: 4px;
}

.routing-action {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #edf7ff;
    color: #245f93;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.5;
}

.pie-card,
.pie-pair-card {
    display: grid;
    align-content: start;
    justify-items: center;
}

.pie-chart {
    display: grid;
    width: 154px;
    height: 154px;
    place-items: center;
    border-radius: 50%;
    box-shadow: inset 0 0 0 18px rgba(255, 255, 255, 0.72);
}

.pie-chart span {
    display: grid;
    width: 78px;
    height: 78px;
    place-items: center;
    border-radius: 50%;
    background: #ffffff;
    color: #253247;
    font-size: 15px;
    font-weight: 900;
}

.pie-chart.small {
    width: 112px;
    height: 112px;
    box-shadow: inset 0 0 0 14px rgba(255, 255, 255, 0.74);
}

.pie-chart.small span {
    width: 60px;
    height: 60px;
    font-size: 12px;
}

.pie-legend,
.strategy-stack {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.pie-legend span,
.strategy-stack span {
    padding: 6px 9px;
    border-radius: 999px;
    background: #eef4fa;
    color: #51647d;
    font-size: 12px;
    font-weight: 800;
}

.pie-legend i {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 6px;
    border-radius: 50%;
}

.area-openai-dot {
    background: #1f7ae0;
}

.area-claude-dot {
    background: #7c5cff;
}

.area-gemini-dot {
    background: #2fb5c8;
}

.area-china-dot {
    background: #19a974;
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

.agent-metrics-grid,
.trust-summary-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
}

.agent-metrics-grid article,
.trust-summary-grid article {
    padding: 12px;
    border: 1px solid #e3ebf4;
    border-radius: 14px;
    background: #ffffff;
}

.agent-metrics-grid span,
.trust-summary-grid span {
    display: block;
    color: #728097;
    font-size: 12px;
}

.agent-metrics-grid strong,
.trust-summary-grid strong {
    display: block;
    margin-top: 5px;
    color: #253247;
    font-size: 17px;
}

.workflow-flow {
    display: grid;
    gap: 9px;
}

.workflow-step {
    display: grid;
    grid-template-columns: minmax(120px, 0.8fr) 34px minmax(160px, 1.2fr);
    align-items: center;
    gap: 10px;
}

.workflow-step > div {
    min-width: 0;
    padding: 10px;
    border-radius: 13px;
    background: #ffffff;
}

.workflow-step strong,
.workflow-step span {
    display: block;
}

.workflow-step strong {
    color: #253247;
    font-size: 13px;
}

.workflow-step span {
    margin-top: 3px;
    color: #728097;
    font-size: 11px;
    line-height: 1.35;
}

.workflow-step i {
    position: relative;
    height: 2px;
    background: #9fb2c9;
}

.workflow-step i::after {
    position: absolute;
    right: -2px;
    top: -4px;
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 7px solid #9fb2c9;
    content: "";
}

.priority-bars,
.fairness-bars {
    display: grid;
    gap: 12px;
}

.priority-row,
.fairness-row {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr) 54px;
    align-items: center;
    gap: 10px;
    color: #66768d;
    font-size: 12px;
    font-weight: 800;
}

.priority-track,
.fairness-track {
    overflow: hidden;
    height: 12px;
    border-radius: 999px;
    background: #e8eef5;
}

.priority-track div,
.fairness-track div {
    height: 100%;
    border-radius: inherit;
    transition: width 420ms ease;
}

.priority-track div {
    background: linear-gradient(90deg, #2fb5c8, #1f7ae0);
}

.tone-green {
    background: #19a974;
}

.tone-blue {
    background: #1f7ae0;
}

.tone-amber {
    background: #f2b84b;
}

.strategy-card p {
    margin: 14px 0 0;
    color: #526176;
    font-size: 13px;
    line-height: 1.6;
}

.pie-pair {
    display: flex;
    justify-content: center;
    gap: 22px;
    width: 100%;
}

.pie-pair > div {
    display: grid;
    justify-items: center;
    gap: 8px;
    color: #728097;
    font-size: 12px;
    font-weight: 800;
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

.reconciliation-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
}

.reconciliation-row {
    display: grid;
    grid-template-columns: minmax(120px, 1.2fr) repeat(3, minmax(72px, 0.8fr)) auto;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    border-radius: 13px;
    background: #f8fafc;
}

.reconciliation-row strong {
    color: #253247;
    font-size: 12px;
}

.reconciliation-row span {
    color: #728097;
    font-size: 11px;
}

.reconciliation-row em {
    justify-self: end;
    font-style: normal;
    white-space: nowrap;
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
    .calibration-summary-grid,
    .agent-metrics-grid,
    .trust-summary-grid,
    .reconciliation-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .provider-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .latency-row {
        grid-template-columns: minmax(180px, 1.4fr) repeat(4, minmax(72px, 1fr));
    }

    .routing-dashboard,
    .agent-dashboard,
    .metering-dashboard,
    .overview-main {
        grid-template-columns: 1fr;
    }

    .reconciliation-row {
        grid-template-columns: minmax(130px, 1fr) repeat(3, minmax(72px, 0.8fr)) auto;
    }
}

@media (max-width: 820px) {
    .tokenfleet-page {
        padding: 14px;
    }

    .event-content,
    .tab-heading,
    .intelligence-card,
    .incident-layout {
        display: block;
    }

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

    .metrics-grid,
    .provider-grid,
    .calibration-list,
    .calibration-summary-grid,
    .agent-metrics-grid,
    .trust-summary-grid,
    .reconciliation-list {
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

    .workflow-step,
    .reconciliation-row {
        grid-template-columns: 1fr;
    }

    .workflow-step i {
        display: none;
    }
}

@media (max-width: 560px) {
    .metrics-grid,
    .provider-grid,
    .calibration-list,
    .calibration-summary-grid,
    .agent-metrics-grid,
    .trust-summary-grid,
    .reconciliation-list {
        grid-template-columns: 1fr;
    }

    .provider-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
