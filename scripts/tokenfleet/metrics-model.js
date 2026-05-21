const { baseProviderState, providerCatalog, scenarioFrames } = require("./scenario");

const FRAME_DURATION_MS = 10000;
const SNAPSHOT_INTERVAL_MS = 5000;

/**
 * Clamp a number inside a range.
 * @param {number} value Input value.
 * @param {number} min Minimum value.
 * @param {number} max Maximum value.
 * @returns {number} Clamped value.
 */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * Format a date as HH:mm.
 * @param {Date} date Date to format.
 * @returns {string} Time label.
 */
function formatTime(date) {
    return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

/**
 * Round a number to a fixed precision and return a number.
 * @param {number} value Input value.
 * @param {number} digits Decimal digits.
 * @returns {number} Rounded number.
 */
function round(value, digits = 2) {
    return Number(value.toFixed(digits));
}

/**
 * Compute the current scenario position from elapsed time.
 * @param {number} elapsedMs Elapsed milliseconds since feed start.
 * @returns {{frameIndex: number, cycle: number, progressInFrame: number, tick: number}} Scenario position.
 */
function getScenarioPosition(elapsedMs) {
    const tick = Math.floor(elapsedMs / SNAPSHOT_INTERVAL_MS);
    const frameIndex = Math.floor(elapsedMs / FRAME_DURATION_MS) % scenarioFrames.length;
    const cycle = Math.floor(elapsedMs / (FRAME_DURATION_MS * scenarioFrames.length));
    const progressInFrame = (elapsedMs % FRAME_DURATION_MS) / FRAME_DURATION_MS;
    return { frameIndex, cycle, progressInFrame, tick };
}

/**
 * Calculate actual traffic with a slight lag behind routing weight.
 * @param {number} frameIndex Current frame index.
 * @param {string} providerId Provider identifier.
 * @param {number} progressInFrame Frame progress from 0 to 1.
 * @returns {number} Actual traffic share.
 */
function trafficShareFor(frameIndex, providerId, progressInFrame) {
    const currentWeight = scenarioFrames[frameIndex].routeWeights[providerId];
    const previousIndex = (frameIndex - 1 + scenarioFrames.length) % scenarioFrames.length;
    const previousWeight = scenarioFrames[previousIndex].routeWeights[providerId];
    const lagged = previousWeight + (currentWeight - previousWeight) * clamp(progressInFrame * 0.62, 0, 1);
    return round(lagged, 1);
}

/**
 * Build provider rows for the current state.
 * @param {object} frame Current scenario frame.
 * @param {number} frameIndex Current frame index.
 * @param {number} progressInFrame Frame progress from 0 to 1.
 * @param {number} tick Feed tick.
 * @param {number} cycle Completed scenario cycles.
 * @returns {object[]} Provider state rows.
 */
function buildProviders(frame, frameIndex, progressInFrame, tick, cycle) {
    return providerCatalog.map((provider, index) => {
        const base = baseProviderState[provider.id];
        const routeWeight = frame.routeWeights[provider.id];
        const actualTrafficShare = trafficShareFor(frameIndex, provider.id, progressInFrame);
        const latencyShift = frame.deltas.latency[provider.id] || 0;
        const errorShift = frame.deltas.error[provider.id] || 0;
        const status = frame.deltas.status[provider.id] || "healthy";
        const growth = cycle * 45000 + tick * (820 + index * 74);
        const tokenGrowth = cycle * 68000000 + tick * (1250000 + index * 91000);
        const requestsToday = Math.round(base.requests + growth * (0.72 + routeWeight / 55));
        const tokensToday = Math.round(base.tokens + tokenGrowth * (0.74 + routeWeight / 52));
        const latencyWave = Math.sin((tick + index) / 3) * 8;
        const latencyP50 =
            status === "maintenance" ? 0 : Math.round(Math.max(180, base.latencyP50 + latencyShift + latencyWave));
        const latencyP95 =
            status === "maintenance"
                ? 0
                : Math.round(Math.max(380, base.latencyP95 + latencyShift * 2.15 + latencyWave * 2.8));
        const errorRate =
            status === "maintenance"
                ? 0
                : round(Math.max(0.02, base.errorRate + errorShift + Math.abs(Math.sin((tick + index) / 4)) * 0.03), 2);
        return {
            ...provider,
            status,
            routeWeight,
            actualTrafficShare,
            uptime24h: round(status === "healthy" ? 99.98 - index * 0.006 : 99.86 - index * 0.01, 2),
            latencyP50,
            latencyP95,
            requestsToday,
            tokensToday,
            tokensMonth: Math.round(base.tokens * 22 + tokenGrowth * 4.5),
            errorRate,
            costToday: Math.round(tokensToday * base.costUnit),
            trend:
                status === "maintenance"
                    ? "maintenance window"
                    : routeWeight > base.routeWeight
                      ? "absorbing traffic"
                      : status === "degraded"
                        ? "protected routing"
                        : "stable",
            lastIncident: status === "healthy" ? "No active impact" : frame.stage,
        };
    });
}

/**
 * Build calibration and billing state.
 * @param {object[]} providers Provider rows.
 * @param {number} frameIndex Current frame index.
 * @param {number} tick Feed tick.
 * @returns {{billing: object, calibration: object}} Billing and calibration state.
 */
function buildBilling(providers, frameIndex, tick) {
    const averageDeltaRate = round(clamp(0.0098 - frameIndex * 0.00115 - tick * 0.00006, 0.00042, 0.0098), 4);
    const maxDeltaRate = round(averageDeltaRate * 1.78, 4);
    const calibrationProviders = providers.map((provider, index) => {
        const deltaRate = round(clamp(averageDeltaRate * (0.72 + index * 0.055), 0.0003, 0.014), 4);
        let calibrationStatus = "校准中";
        if (deltaRate <= 0.0008) {
            calibrationStatus = "精准同步";
        } else if (deltaRate <= 0.0025) {
            calibrationStatus = "已收敛";
        }
        return {
            id: provider.id,
            name: provider.name,
            actualUsage: provider.tokensToday,
            billedUsage: Math.round(provider.tokensToday * (1 + deltaRate / 100)),
            deltaRate,
            calibrationStatus,
        };
    });
    return {
        billing: {
            fairBillingScore: round(99.9 + (0.0098 - averageDeltaRate) * 9.3, 3),
            averageDeltaRate,
            maxDeltaRate,
            failedRequestsFree: 8400 + tick * 112 + frameIndex * 260,
            retryDeduped: 3100 + tick * 84 + frameIndex * 180,
            reconciledBills: 9,
            explainableRequests: round(99.82 + frameIndex * 0.018, 3),
            providers: calibrationProviders,
            calibrationSeries: buildCalibrationSeries(frameIndex, providers, averageDeltaRate),
        },
        calibration: {
            averageDeltaRate,
            maxDeltaRate,
            convergedApis: calibrationProviders.filter((provider) => provider.deltaRate <= 0.0025).length,
            cycle: averageDeltaRate <= 0.001 ? "十万分之一级校准" : "实时转接对账",
            providers: calibrationProviders,
        },
    };
}

/**
 * Build actual versus billed usage trend points.
 * @param {number} frameIndex Current frame index.
 * @param {object[]} providers Provider rows.
 * @param {number} averageDeltaRate Current average delta rate.
 * @returns {object[]} Calibration trend points.
 */
function buildCalibrationSeries(frameIndex, providers, averageDeltaRate) {
    const actualBase = providers.reduce((sum, provider) => sum + provider.tokensToday, 0) / 10000000;
    return Array.from({ length: frameIndex + 1 }, (_, index) => {
        const actualUsage = round(actualBase * (0.92 + index * 0.012), 2);
        const deltaRate = round(Math.max(0.0004, averageDeltaRate + (frameIndex - index) * 0.00035), 4);
        return {
            second: index * 10,
            actualUsage,
            billedUsage: round(actualUsage * (1 + deltaRate / 100), 2),
            deltaRate,
        };
    });
}

/**
 * Build routing trend and current split.
 * @param {number} frameIndex Current frame index.
 * @returns {object} Routing state.
 */
function buildRouting(frameIndex) {
    const series = scenarioFrames.slice(0, frameIndex + 1).map((frame, index) => ({
        second: index * 10,
        openai: frame.routeWeights.openai,
        claude: frame.routeWeights.claude,
        gemini: frame.routeWeights.gemini,
        chinaPool:
            frame.routeWeights.deepseek +
            frame.routeWeights.kimi +
            frame.routeWeights.minimax +
            frame.routeWeights.zhipu +
            frame.routeWeights.seedance,
        other: frame.routeWeights.grok,
        action: frame.summaryText,
    }));
    const current = series[series.length - 1];
    return {
        current,
        series,
    };
}

/**
 * Build Agent scheduling metrics.
 * @param {number} frameIndex Current frame index.
 * @param {number} tick Feed tick.
 * @returns {object} Agent metrics.
 */
function buildAgent(frameIndex, tick) {
    const queuedBase = [318, 336, 352, 374, 361, 388, 416, 392, 376][frameIndex];
    return {
        activeAgents: 128 + frameIndex * 4 + (tick % 5),
        runningWorkflows: 42 + frameIndex * 2 + (tick % 3),
        queuedTasks: queuedBase + (tick % 4) * 5,
        completedToday: 48200 + tick * 420 + frameIndex * 1800,
        slaMetRate: round(98.72 + frameIndex * 0.09 + Math.sin(tick / 5) * 0.08, 2),
        costSavedRate: round(12.4 + frameIndex * 1.35 + Math.sin(tick / 4) * 0.3, 2),
        routingEfficiency: round(92.4 + frameIndex * 0.55 + Math.sin(tick / 6) * 0.3, 1),
        costSavedToday: 1840 + frameIndex * 210 + tick * 32,
        throughput: 1240 + frameIndex * 42 + tick * 4,
        priority: {
            P0: 16 + frameIndex + (tick % 3),
            P1: 86 + frameIndex * 4 + (tick % 5),
            P2: 142 + frameIndex * 7 + (tick % 7),
            P3: 72 + frameIndex + (tick % 4),
        },
        strategyStack: ["SLA 优先", "质量阈值", frameIndex >= 6 ? "成本守护" : "延迟保护", "可信计量"],
        workflowRoutes: [
            {
                node: "Agent Intake",
                target: "SLA Classifier",
                modelPool: "Gateway Policy",
                reason: "识别优先级、语言和上下文长度",
            },
            {
                node: "Plan",
                target: "Reasoning Pool",
                modelPool: frameIndex >= 7 ? "Claude + GLM" : "Claude + OpenAI",
                reason: "质量阈值与长上下文能力优先",
            },
            {
                node: "Retrieve",
                target: "Fast Pool",
                modelPool: frameIndex >= 6 ? "DeepSeek + Kimi" : "OpenAI + Gemini",
                reason: "低延迟检索与中文语义匹配",
            },
            {
                node: "Execute",
                target: "Cost Pool",
                modelPool: "DeepSeek + MiniMax + GLM",
                reason: "批量任务按成本与稳定性调度",
            },
            {
                node: "Verify",
                target: "Audit Pool",
                modelPool: "OpenAI + Kimi",
                reason: "结果回看、链路解释与计量校准",
            },
        ],
    };
}

/**
 * Build a minute-level availability series for the last eight hours.
 * @param {Date} now Current timestamp.
 * @param {number} frameIndex Current frame index.
 * @param {number} tick Feed tick.
 * @param {number} fairBillingScore Current fair billing score.
 * @returns {object[]} Availability points.
 */
function buildAvailabilitySeries(now, frameIndex, tick, fairBillingScore) {
    const pointsPerFrame = 7;
    const visiblePoints = Math.min(72, (frameIndex + 1) * pointsPerFrame + (tick % 2) * 2);
    const startOffset = -480;
    const endOffset = -480 + (visiblePoints - 1) * (480 / 71);
    return Array.from({ length: visiblePoints }, (_, index) => {
        const offsetMinutes =
            visiblePoints === 1
                ? startOffset
                : startOffset + (index / Math.max(1, visiblePoints - 1)) * (endOffset - startOffset);
        const timestamp = new Date(now.getTime() + offsetMinutes * 60000);
        const recoveryCurve = 99.91 + index * 0.0011;
        const incidentDip =
            frameIndex >= 5 && index > visiblePoints * 0.48 && index < visiblePoints * 0.76 ? -0.018 : 0;
        const value = round(
            clamp(
                recoveryCurve + incidentDip + Math.sin((tick + index) / 8) * 0.003,
                99.9,
                Math.min(100, fairBillingScore)
            ),
            3
        );
        return {
            timestamp: timestamp.toISOString(),
            time: formatTime(timestamp),
            offsetMinutes: round(offsetMinutes, 2),
            value: index === visiblePoints - 1 ? fairBillingScore : value,
        };
    });
}

/**
 * Build incident feed for all frames up to the current one.
 * @param {number} frameIndex Current frame index.
 * @param {Date} now Current timestamp.
 * @returns {object[]} Incident rows.
 */
function buildIncidents(frameIndex, now) {
    return scenarioFrames
        .slice(0, frameIndex + 1)
        .filter((frame) => frame.incident)
        .map((frame, index) => {
            const occurredAt = new Date(now.getTime() - (frameIndex - index) * FRAME_DURATION_MS);
            return {
                id: `tf-${String(index).padStart(3, "0")}`,
                time: formatTime(occurredAt),
                provider: frame.incident[0],
                type: index >= 5 ? "protection" : "routing",
                level:
                    index === frameIndex && frame.activeIncidents > 1
                        ? "warning"
                        : index === frameIndex
                          ? "info"
                          : "resolved",
                title: frame.incident[1],
                description: frame.incident[2],
                action: frame.summaryText,
                status: index === frameIndex ? "active" : "resolved",
            };
        });
}

/**
 * Build a complete state snapshot for the TokenFleet page.
 * @param {{startedAt?: number, now?: Date}} options Build options.
 * @returns {object} Current state snapshot.
 */
function buildState(options = {}) {
    const now = options.now || new Date();
    const startedAt = options.startedAt || now.getTime();
    const elapsedMs = Math.max(0, now.getTime() - startedAt);
    const { frameIndex, cycle, progressInFrame, tick } = getScenarioPosition(elapsedMs);
    const frame = scenarioFrames[frameIndex];
    const providers = buildProviders(frame, frameIndex, progressInFrame, tick, cycle);
    const { billing, calibration } = buildBilling(providers, frameIndex, tick);
    const routing = buildRouting(frameIndex);
    const agent = buildAgent(frameIndex, tick);
    const totalRequests = providers.reduce((sum, provider) => sum + provider.requestsToday, 0);
    const totalTokens = providers.reduce((sum, provider) => sum + provider.tokensToday, 0);
    const weightedLatency =
        providers.reduce((sum, provider) => sum + provider.latencyP50 * provider.actualTrafficShare, 0) / 100;
    const availabilitySeries = buildAvailabilitySeries(now, frameIndex, tick, billing.fairBillingScore);
    return {
        meta: {
            updatedAt: now.toISOString(),
            stage: frame.stage,
            stageHint: frame.stageHint,
            frame: frameIndex + 1,
            frameTotal: scenarioFrames.length,
        },
        summary: {
            gatewayHealth: frame.health,
            providersOnline: `${providers.filter((provider) => provider.status !== "maintenance").length} / ${providers.length}`,
            avgLatencyMs: Math.round(weightedLatency),
            requestsToday: totalRequests,
            tokensToday: totalTokens,
            activeIncidents: frame.activeIncidents,
            fairBillingScore: billing.fairBillingScore,
            routingEfficiency: agent.routingEfficiency,
            agentSlaMetRate: agent.slaMetRate,
        },
        providers,
        routing,
        billing,
        calibration,
        agent,
        availabilitySeries,
        incidents: buildIncidents(frameIndex, now),
        summaryText: frame.summaryText,
    };
}

module.exports = {
    buildState,
    FRAME_DURATION_MS,
    SNAPSHOT_INTERVAL_MS,
};
