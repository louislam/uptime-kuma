const providerCatalog = [
    {
        id: "openai",
        name: "OpenAI API",
        company: "OpenAI",
        endpoint: "api.openai.com/v1",
        group: "International",
        models: ["gpt-4.1", "gpt-4o", "o3-mini"],
    },
    {
        id: "claude",
        name: "Claude API / Anthropic",
        company: "Anthropic",
        endpoint: "api.anthropic.com/v1",
        group: "International",
        models: ["claude-3.5-sonnet", "claude-3-opus", "claude-3-haiku"],
    },
    {
        id: "gemini",
        name: "Gemini API / Google",
        company: "Google",
        endpoint: "generativelanguage.googleapis.com",
        group: "International",
        models: ["gemini-1.5-pro", "gemini-1.5-flash", "embedding-001"],
    },
    {
        id: "deepseek",
        name: "DeepSeek API",
        company: "DeepSeek",
        endpoint: "api.deepseek.com/v1",
        group: "China",
        models: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"],
    },
    {
        id: "kimi",
        name: "Kimi API / Moonshot AI",
        company: "Moonshot AI",
        endpoint: "api.moonshot.cn/v1",
        group: "China",
        models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    },
    {
        id: "minimax",
        name: "MiniMax API",
        company: "MiniMax",
        endpoint: "api.minimax.chat/v1",
        group: "China",
        models: ["abab6.5s-chat", "abab6.5g-chat", "embo-01"],
    },
    {
        id: "zhipu",
        name: "Zhipu GLM API / 智谱 AI",
        company: "智谱 AI",
        endpoint: "open.bigmodel.cn/api/paas/v4",
        group: "China",
        models: ["glm-4-plus", "glm-4-air", "embedding-3"],
    },
    {
        id: "seedance",
        name: "SeeDance API",
        company: "SeeDance",
        endpoint: "api.seedance.com/v1",
        group: "China",
        models: ["seedance-pro", "seedance-lite", "seedance-vision"],
    },
    {
        id: "grok",
        name: "Grok API / xAI",
        company: "xAI",
        endpoint: "api.x.ai/v1",
        group: "International",
        models: ["grok-2", "grok-2-mini", "grok-vision"],
    },
];

const baseProviderState = {
    openai: {
        status: "healthy",
        routeWeight: 22,
        actualTrafficShare: 22,
        uptime24h: 99.99,
        latencyP50: 286,
        latencyP95: 718,
        requestsToday: 183420,
        tokensToday: 238400000,
        tokensMonth: 5180000000,
        errorRate: 0.08,
        costToday: 3826,
        trend: "stable",
        lastIncident: "No active impact",
    },
    claude: {
        status: "healthy",
        routeWeight: 18,
        actualTrafficShare: 18,
        uptime24h: 99.98,
        latencyP50: 342,
        latencyP95: 864,
        requestsToday: 148960,
        tokensToday: 196700000,
        tokensMonth: 4380000000,
        errorRate: 0.1,
        costToday: 4118,
        trend: "stable",
        lastIncident: "No active impact",
    },
    gemini: {
        status: "healthy",
        routeWeight: 16,
        actualTrafficShare: 16,
        uptime24h: 99.97,
        latencyP50: 318,
        latencyP95: 796,
        requestsToday: 131280,
        tokensToday: 172900000,
        tokensMonth: 3920000000,
        errorRate: 0.11,
        costToday: 2146,
        trend: "stable",
        lastIncident: "No active impact",
    },
    deepseek: {
        status: "healthy",
        routeWeight: 12,
        actualTrafficShare: 12,
        uptime24h: 99.96,
        latencyP50: 254,
        latencyP95: 642,
        requestsToday: 104760,
        tokensToday: 143600000,
        tokensMonth: 3260000000,
        errorRate: 0.07,
        costToday: 824,
        trend: "stable",
        lastIncident: "No active impact",
    },
    kimi: {
        status: "healthy",
        routeWeight: 10,
        actualTrafficShare: 10,
        uptime24h: 99.95,
        latencyP50: 272,
        latencyP95: 690,
        requestsToday: 92480,
        tokensToday: 126400000,
        tokensMonth: 2870000000,
        errorRate: 0.09,
        costToday: 768,
        trend: "stable",
        lastIncident: "No active impact",
    },
    minimax: {
        status: "healthy",
        routeWeight: 8,
        actualTrafficShare: 8,
        uptime24h: 99.94,
        latencyP50: 298,
        latencyP95: 744,
        requestsToday: 78840,
        tokensToday: 102200000,
        tokensMonth: 2310000000,
        errorRate: 0.1,
        costToday: 692,
        trend: "stable",
        lastIncident: "No active impact",
    },
    zhipu: {
        status: "healthy",
        routeWeight: 7,
        actualTrafficShare: 7,
        uptime24h: 99.93,
        latencyP50: 310,
        latencyP95: 772,
        requestsToday: 69160,
        tokensToday: 91700000,
        tokensMonth: 2080000000,
        errorRate: 0.12,
        costToday: 604,
        trend: "stable",
        lastIncident: "No active impact",
    },
    seedance: {
        status: "healthy",
        routeWeight: 4,
        actualTrafficShare: 4,
        uptime24h: 99.91,
        latencyP50: 328,
        latencyP95: 814,
        requestsToday: 37120,
        tokensToday: 48600000,
        tokensMonth: 1120000000,
        errorRate: 0.13,
        costToday: 418,
        trend: "stable",
        lastIncident: "No active impact",
    },
    grok: {
        status: "healthy",
        routeWeight: 3,
        actualTrafficShare: 3,
        uptime24h: 99.9,
        latencyP50: 362,
        latencyP95: 910,
        requestsToday: 28640,
        tokensToday: 38200000,
        tokensMonth: 890000000,
        errorRate: 0.14,
        costToday: 536,
        trend: "stable",
        lastIncident: "No active impact",
    },
};

/**
 * Build frame provider states while preserving the fixed provider order.
 * @param {object} overrides Per-provider state changes for a timeline frame.
 * @returns {object[]} Provider state list for the frame.
 */
function buildProviders(overrides = {}) {
    return providerCatalog.map((provider) => ({
        ...provider,
        ...baseProviderState[provider.id],
        ...(overrides[provider.id] || {}),
    }));
}

const calibrationFrameConfigs = [
    {
        averageDeltaRate: 0.0098,
        maxDeltaRate: 0.0142,
        convergedApis: 1,
        cycle: "第 1 轮实时校准",
        deltas: [0.0087, 0.0118, 0.0109, 0.0094, 0.0092, 0.0096, 0.0089, 0.0142, 0.0065],
    },
    {
        averageDeltaRate: 0.0067,
        maxDeltaRate: 0.0104,
        convergedApis: 2,
        cycle: "延迟波动校准",
        deltas: [0.0059, 0.0104, 0.0097, 0.0061, 0.0058, 0.0063, 0.0056, 0.0078, 0.0027],
    },
    {
        averageDeltaRate: 0.0042,
        maxDeltaRate: 0.0068,
        convergedApis: 3,
        cycle: "第一轮转接对账完成",
        deltas: [0.0038, 0.0068, 0.0056, 0.0039, 0.0037, 0.0041, 0.0034, 0.0046, 0.0020],
    },
    {
        averageDeltaRate: 0.0024,
        maxDeltaRate: 0.0041,
        convergedApis: 5,
        cycle: "国产模型池校准收敛",
        deltas: [0.0023, 0.0041, 0.0032, 0.0018, 0.0017, 0.0019, 0.0021, 0.0029, 0.0016],
    },
    {
        averageDeltaRate: 0.0013,
        maxDeltaRate: 0.0024,
        convergedApis: 7,
        cycle: "维护窗口对账校准",
        deltas: [0.0012, 0.0024, 0.0018, 0.0011, 0.0010, 0.0011, 0.0012, 0.0017, 0.0010],
    },
    {
        averageDeltaRate: 0.0009,
        maxDeltaRate: 0.0015,
        convergedApis: 8,
        cycle: "十万分之一级校准",
        deltas: [0.0008, 0.0013, 0.0015, 0.0007, 0.0007, 0.0008, 0.0008, 0.0010, 0.0006],
    },
    {
        averageDeltaRate: 0.0007,
        maxDeltaRate: 0.0011,
        convergedApis: 9,
        cycle: "主力 API 精准同步",
        deltas: [0.0006, 0.0008, 0.0011, 0.0006, 0.0005, 0.0006, 0.0007, 0.0008, 0.0006],
    },
    {
        averageDeltaRate: 0.0006,
        maxDeltaRate: 0.0010,
        convergedApis: 9,
        cycle: "稳定同步巡检",
        deltas: [0.0005, 0.0007, 0.0010, 0.0005, 0.0005, 0.0006, 0.0006, 0.0007, 0.0005],
    },
    {
        averageDeltaRate: 0.0005,
        maxDeltaRate: 0.0009,
        convergedApis: 9,
        cycle: "校准闭环完成",
        deltas: [0.0004, 0.0006, 0.0009, 0.0004, 0.0004, 0.0005, 0.0005, 0.0006, 0.0004],
    },
];

/**
 * Build calibration data for gateway transfer reconciliation.
 * @param {number} frameIndex Zero-based timeline frame index.
 * @returns {object} Calibration summary and per-provider usage pairs.
 */
function buildCalibration(frameIndex) {
    const config = calibrationFrameConfigs[frameIndex];
    return {
        averageDeltaRate: config.averageDeltaRate,
        maxDeltaRate: config.maxDeltaRate,
        convergedApis: config.convergedApis,
        cycle: config.cycle,
        providers: providerCatalog.map((provider, index) => {
            const actualUsage = baseProviderState[provider.id].tokensToday + frameIndex * (620000 + index * 37000);
            const deltaRate = config.deltas[index];
            const billedUsage = Math.round(actualUsage * (1 + deltaRate / 100));
            let calibrationStatus = "校准中";
            if (deltaRate <= 0.0008) {
                calibrationStatus = "精准同步";
            } else if (deltaRate <= 0.0025) {
                calibrationStatus = "已收敛";
            }
            return {
                id: provider.id,
                name: provider.name,
                actualUsage,
                billedUsage,
                deltaRate,
                calibrationStatus,
            };
        }),
    };
}

const routingSnapshots = [
    { openai: 22, claude: 18, gemini: 16, chinaPool: 41, other: 3, action: "均衡分发：质量、延迟与成本权重保持稳定。" },
    { openai: 23, claude: 18, gemini: 16, chinaPool: 40, other: 3, action: "延迟观察：Claude 被纳入性能保护窗口。" },
    { openai: 25, claude: 9, gemini: 18, chinaPool: 47, other: 1, action: "自动切流：高优先级请求从 Claude 转向低延迟池。" },
    { openai: 23, claude: 8, gemini: 17, chinaPool: 51, other: 1, action: "国产模型池承接：DeepSeek 与 Kimi 吸收更多批量任务。" },
    { openai: 24, claude: 8, gemini: 18, chinaPool: 49, other: 1, action: "维护隔离：SeeDance 权重归零，多模态请求转移。" },
    { openai: 27, claude: 8, gemini: 10, chinaPool: 54, other: 1, action: "错误保护：Gemini 5xx 触发重试去重与熔断转交。" },
    { openai: 21, claude: 7, gemini: 8, chinaPool: 63, other: 1, action: "成本守护：批量任务转向国产模型池，保留质量阈值。" },
    { openai: 22, claude: 13, gemini: 9, chinaPool: 55, other: 1, action: "阶梯恢复：Claude 权重逐步回升，避免瞬时回流。" },
    { openai: 22, claude: 16, gemini: 15, chinaPool: 46, other: 1, action: "恢复稳定：策略总结写入日间路由基线。" },
];

const agentMetricFrames = [
    { activeAgents: 128, runningWorkflows: 42, queuedTasks: 318, slaMetRate: 99.12, routingEfficiency: 93.4, costSavedToday: 1840, throughput: 1240, priority: { P0: 18, P1: 86, P2: 142, P3: 72 }, strategyStack: ["SLA 优先", "质量阈值", "成本守护", "中文能力匹配"] },
    { activeAgents: 133, runningWorkflows: 45, queuedTasks: 336, slaMetRate: 98.74, routingEfficiency: 91.8, costSavedToday: 1910, throughput: 1276, priority: { P0: 22, P1: 94, P2: 148, P3: 72 }, strategyStack: ["延迟保护", "SLA 优先", "重试去重", "长上下文兜底"] },
    { activeAgents: 141, runningWorkflows: 49, queuedTasks: 352, slaMetRate: 98.92, routingEfficiency: 92.6, costSavedToday: 2060, throughput: 1328, priority: { P0: 20, P1: 98, P2: 158, P3: 76 }, strategyStack: ["自动切流", "低延迟池", "质量阈值", "重试去重"] },
    { activeAgents: 148, runningWorkflows: 53, queuedTasks: 374, slaMetRate: 99.04, routingEfficiency: 94.1, costSavedToday: 2380, throughput: 1396, priority: { P0: 19, P1: 104, P2: 172, P3: 79 }, strategyStack: ["国产模型承接", "成本守护", "中文能力匹配", "批量任务降本"] },
    { activeAgents: 146, runningWorkflows: 51, queuedTasks: 361, slaMetRate: 98.86, routingEfficiency: 93.7, costSavedToday: 2490, throughput: 1378, priority: { P0: 17, P1: 101, P2: 166, P3: 77 }, strategyStack: ["维护隔离", "视觉任务转交", "容量保护", "计量校准"] },
    { activeAgents: 153, runningWorkflows: 56, queuedTasks: 388, slaMetRate: 98.68, routingEfficiency: 92.9, costSavedToday: 2630, throughput: 1442, priority: { P0: 25, P1: 112, P2: 174, P3: 77 }, strategyStack: ["5xx 熔断", "幂等重试", "失败免计", "供应商对账"] },
    { activeAgents: 161, runningWorkflows: 61, queuedTasks: 416, slaMetRate: 99.18, routingEfficiency: 95.6, costSavedToday: 3180, throughput: 1534, priority: { P0: 21, P1: 118, P2: 196, P3: 81 }, strategyStack: ["任务优先级调度", "成本守护", "国产模型池", "质量回看"] },
    { activeAgents: 158, runningWorkflows: 58, queuedTasks: 392, slaMetRate: 99.31, routingEfficiency: 96.4, costSavedToday: 3260, throughput: 1510, priority: { P0: 18, P1: 110, P2: 184, P3: 80 }, strategyStack: ["阶梯恢复", "SLA 稳定", "质量阈值", "长上下文能力"] },
    { activeAgents: 162, runningWorkflows: 60, queuedTasks: 376, slaMetRate: 99.46, routingEfficiency: 97.1, costSavedToday: 3420, throughput: 1568, priority: { P0: 16, P1: 106, P2: 178, P3: 76 }, strategyStack: ["稳定基线", "可信计量", "成本核对", "策略解释"] },
];

const billingMetricFrames = [
    { fairBillingScore: 99.91, failedRequestsFree: 8420, retryDeduped: 3180, reconciledBills: 9, explainableRequests: 99.82 },
    { fairBillingScore: 99.93, failedRequestsFree: 8940, retryDeduped: 3420, reconciledBills: 9, explainableRequests: 99.84 },
    { fairBillingScore: 99.95, failedRequestsFree: 9360, retryDeduped: 3860, reconciledBills: 9, explainableRequests: 99.87 },
    { fairBillingScore: 99.96, failedRequestsFree: 9820, retryDeduped: 4210, reconciledBills: 9, explainableRequests: 99.9 },
    { fairBillingScore: 99.97, failedRequestsFree: 10160, retryDeduped: 4380, reconciledBills: 9, explainableRequests: 99.92 },
    { fairBillingScore: 99.975, failedRequestsFree: 11840, retryDeduped: 5260, reconciledBills: 9, explainableRequests: 99.94 },
    { fairBillingScore: 99.982, failedRequestsFree: 12320, retryDeduped: 5480, reconciledBills: 9, explainableRequests: 99.96 },
    { fairBillingScore: 99.986, failedRequestsFree: 12680, retryDeduped: 5620, reconciledBills: 9, explainableRequests: 99.97 },
    { fairBillingScore: 99.991, failedRequestsFree: 12940, retryDeduped: 5740, reconciledBills: 9, explainableRequests: 99.98 },
];

/**
 * Build routing trend snapshots up to the current frame.
 * @param {number} frameIndex Zero-based timeline frame index.
 * @returns {object[]} Routing trend snapshots.
 */
function buildRoutingSeries(frameIndex) {
    return routingSnapshots.slice(0, frameIndex + 1).map((snapshot, index) => ({
        second: index * 10,
        ...snapshot,
    }));
}

/**
 * Build metering convergence points up to the current frame.
 * @param {number} frameIndex Zero-based timeline frame index.
 * @returns {object[]} Metering convergence points.
 */
function buildCalibrationSeries(frameIndex) {
    return calibrationFrameConfigs.slice(0, frameIndex + 1).map((config, index) => {
        const baseActual = 100 + index * 9.8;
        return {
            second: index * 10,
            actualUsage: Number(baseActual.toFixed(2)),
            billedUsage: Number((baseActual * (1 + config.averageDeltaRate / 100)).toFixed(2)),
            deltaRate: config.averageDeltaRate,
        };
    });
}

/**
 * Build fair billing event counters for the current frame.
 * @param {number} frameIndex Zero-based timeline frame index.
 * @returns {object[]} Fair billing events.
 */
function buildFairnessEvents(frameIndex) {
    const metrics = billingMetricFrames[frameIndex];
    return [
        { label: "失败请求免计", value: metrics.failedRequestsFree, tone: "green" },
        { label: "重试请求去重", value: metrics.retryDeduped, tone: "blue" },
        { label: "供应商账单对账", value: metrics.reconciledBills, tone: "amber" },
    ];
}

/**
 * Build workflow routing explanation rows for the current frame.
 * @param {number} frameIndex Zero-based timeline frame index.
 * @returns {object[]} Workflow routing rows.
 */
function buildWorkflowRouting(frameIndex) {
    const fastPool = frameIndex >= 6 ? "DeepSeek + Kimi" : "OpenAI + Gemini";
    const reasoningPool = frameIndex >= 7 ? "Claude + GLM" : "Claude + OpenAI";
    return [
        { node: "Agent Intake", target: "SLA Classifier", modelPool: "Gateway Policy", reason: "识别优先级、语言、上下文长度" },
        { node: "Plan", target: "Reasoning Pool", modelPool: reasoningPool, reason: "质量阈值与长上下文能力优先" },
        { node: "Retrieve", target: "Fast Pool", modelPool: fastPool, reason: "低延迟检索与中文语义匹配" },
        { node: "Execute", target: "Cost Pool", modelPool: "DeepSeek + MiniMax + GLM", reason: "批量任务按成本与稳定性调度" },
        { node: "Verify", target: "Audit Pool", modelPool: "OpenAI + Kimi", reason: "结果回看、链路解释与计量校准" },
    ];
}

const rawTimeline = [
    {
        frame: 1,
        second: 0,
        headline: "全链路稳定运行",
        narrative: "统一网关保持九家模型 API 的健康接入，路由策略按实时容量、延迟和成本权重平衡分发请求。",
        summaryMetrics: {
            gatewayHealth: "Healthy",
            providersOnline: "9 / 9",
            avgLatency: 307,
            requestsToday: 874660,
            tokensToday: 1154700000,
            activeIncidents: 0,
        },
        providers: buildProviders(),
        calibration: buildCalibration(0),
        incidents: [
            {
                id: "tf-000",
                time: "09:00:00",
                provider: "Gateway",
                type: "routing",
                level: "info",
                title: "日间策略已进入均衡模式",
                description: "实时路由器按 SLA、成本和吞吐容量对九家模型 API 进行加权分发。",
                action: "维持当前权重并持续采样。",
                status: "observing",
            },
        ],
        gatewaySummary:
            "TokenFleet 正在对多路 API 转接链路中的实际用量与计价用量进行实时校准。当前平均差异率为 0.0098%，多数 API 处于校准中，入口队列、重试队列与对账采样均运行正常。",
    },
    {
        frame: 2,
        second: 10,
        headline: "Claude API 延迟升高",
        narrative: "Claude API 的 P95 延迟连续两个采样窗口上行，网关将其标记为轻度性能退化并开始观察切流条件。",
        summaryMetrics: {
            gatewayHealth: "Degraded",
            providersOnline: "9 / 9",
            avgLatency: 352,
            requestsToday: 881940,
            tokensToday: 1164300000,
            activeIncidents: 1,
        },
        providers: buildProviders({
            claude: {
                status: "degraded",
                latencyP50: 682,
                latencyP95: 1840,
                errorRate: 0.22,
                trend: "rising latency",
                lastIncident: "P95 latency above routing threshold",
            },
            openai: { actualTrafficShare: 23, requestsToday: 185040, tokensToday: 240900000, costToday: 3868 },
            gemini: { actualTrafficShare: 16, requestsToday: 132620, tokensToday: 174500000, costToday: 2168 },
        }),
        calibration: buildCalibration(1),
        incidents: [
            {
                id: "tf-010",
                time: "09:00:10",
                provider: "Claude API / Anthropic",
                type: "latency",
                level: "warning",
                title: "P95 延迟超过阈值",
                description: "P95 延迟升至 1840 ms，超过网关高优先级请求的延迟预算。",
                action: "提升采样频率，准备调整高优先级路由。",
                status: "active",
            },
        ],
        gatewaySummary:
            "Claude 与 Gemini 的链路波动带来轻微计量偏差，TokenFleet 已将平均差异率收敛至 0.0067%。绿色表示网关侧实际转接用量，黄色表示供应商计价用量。",
    },
    {
        frame: 3,
        second: 20,
        headline: "网关自动降低 Claude 路由权重",
        narrative: "延迟守护策略触发后，Claude API 的路由权重从 18% 下调至 9%，高优先级请求转向低延迟供应商。",
        summaryMetrics: {
            gatewayHealth: "Degraded",
            providersOnline: "9 / 9",
            avgLatency: 326,
            requestsToday: 889520,
            tokensToday: 1175100000,
            activeIncidents: 1,
        },
        providers: buildProviders({
            openai: {
                routeWeight: 25,
                actualTrafficShare: 25,
                requestsToday: 187900,
                tokensToday: 244800000,
                costToday: 3930,
            },
            claude: {
                status: "degraded",
                routeWeight: 9,
                actualTrafficShare: 10,
                latencyP50: 640,
                latencyP95: 1715,
                requestsToday: 150180,
                tokensToday: 198200000,
                errorRate: 0.2,
                costToday: 4152,
                trend: "weight reduced",
                lastIncident: "Automatic route reduction in effect",
            },
            gemini: { routeWeight: 18, actualTrafficShare: 18, requestsToday: 135110, tokensToday: 177800000 },
            deepseek: { routeWeight: 14, actualTrafficShare: 13, requestsToday: 107480, tokensToday: 147900000 },
            kimi: { routeWeight: 12, actualTrafficShare: 11, requestsToday: 94940, tokensToday: 130100000 },
        }),
        calibration: buildCalibration(2),
        incidents: [
            {
                id: "tf-020",
                time: "09:00:20",
                provider: "Gateway",
                type: "routing",
                level: "info",
                title: "Claude 路由权重已自动下调",
                description: "低延迟池接管部分对话与批量补全请求，保持入口 SLA 稳定。",
                action: "保留恢复窗口，等待连续健康采样。",
                status: "applied",
            },
        ],
        gatewaySummary:
            "第一轮转接对账已完成，平均差异率下降到 0.0042%。Claude 权重下调后，OpenAI、Gemini、DeepSeek 与 Kimi 的实际用量和计价用量继续贴合。",
    },
    {
        frame: 4,
        second: 30,
        headline: "DeepSeek 与 Kimi 承接更多流量",
        narrative: "国产模型池进入弹性承接模式，DeepSeek 与 Kimi 的实时流量占比上升，用于吸收中低成本批量任务。",
        summaryMetrics: {
            gatewayHealth: "Degraded",
            providersOnline: "9 / 9",
            avgLatency: 302,
            requestsToday: 897180,
            tokensToday: 1186900000,
            activeIncidents: 1,
        },
        providers: buildProviders({
            openai: { routeWeight: 23, actualTrafficShare: 23, requestsToday: 189760, tokensToday: 247100000 },
            claude: {
                status: "degraded",
                routeWeight: 8,
                actualTrafficShare: 8,
                latencyP50: 596,
                latencyP95: 1512,
                errorRate: 0.18,
                trend: "stabilizing",
                lastIncident: "Reduced traffic while latency recovers",
            },
            gemini: { routeWeight: 17, actualTrafficShare: 17, requestsToday: 137020, tokensToday: 180200000 },
            deepseek: {
                routeWeight: 18,
                actualTrafficShare: 18,
                requestsToday: 112960,
                tokensToday: 156300000,
                tokensMonth: 3286000000,
                costToday: 872,
                trend: "absorbing traffic",
            },
            kimi: {
                routeWeight: 15,
                actualTrafficShare: 15,
                requestsToday: 100840,
                tokensToday: 139600000,
                tokensMonth: 2908000000,
                costToday: 816,
                trend: "absorbing traffic",
            },
            minimax: { routeWeight: 8, actualTrafficShare: 8, requestsToday: 79880, tokensToday: 103800000 },
            zhipu: { routeWeight: 7, actualTrafficShare: 7, requestsToday: 70020, tokensToday: 93000000 },
            seedance: { routeWeight: 3, actualTrafficShare: 3 },
            grok: { routeWeight: 1, actualTrafficShare: 1 },
        }),
        calibration: buildCalibration(3),
        incidents: [
            {
                id: "tf-030",
                time: "09:00:30",
                provider: "DeepSeek API, Kimi API / Moonshot AI",
                type: "capacity",
                level: "info",
                title: "国产模型池承接流量提升",
                description: "DeepSeek 与 Kimi 已承接新增批量任务与低延迟会话请求。",
                action: "保持成本守护优先级，继续监控 P95 延迟。",
                status: "applied",
            },
        ],
        gatewaySummary:
            "国产模型池承接流量后，DeepSeek、Kimi 与 MiniMax 的实际用量和计价用量进一步贴合。当前平均差异率为 0.0024%，多路对账进入收敛状态。",
    },
    {
        frame: 5,
        second: 40,
        headline: "SeeDance 进入维护窗口",
        narrative: "SeeDance API 进入计划维护窗口，网关将其权重置为 0，并将视觉与多模态请求转移到可用模型池。",
        summaryMetrics: {
            gatewayHealth: "Degraded",
            providersOnline: "8 / 9",
            avgLatency: 309,
            requestsToday: 904880,
            tokensToday: 1197600000,
            activeIncidents: 2,
        },
        providers: buildProviders({
            openai: { routeWeight: 24, actualTrafficShare: 24, requestsToday: 191320, tokensToday: 249400000 },
            claude: {
                status: "degraded",
                routeWeight: 8,
                actualTrafficShare: 8,
                latencyP50: 540,
                latencyP95: 1368,
                errorRate: 0.16,
                trend: "recovering",
                lastIncident: "Reduced traffic while latency recovers",
            },
            gemini: { routeWeight: 18, actualTrafficShare: 18, requestsToday: 139840, tokensToday: 184100000 },
            deepseek: { routeWeight: 18, actualTrafficShare: 18, requestsToday: 115440, tokensToday: 160300000 },
            kimi: { routeWeight: 15, actualTrafficShare: 15, requestsToday: 103020, tokensToday: 143200000 },
            minimax: { routeWeight: 9, actualTrafficShare: 9, requestsToday: 81520, tokensToday: 106200000 },
            zhipu: { routeWeight: 7, actualTrafficShare: 7, requestsToday: 71560, tokensToday: 95100000 },
            seedance: {
                status: "maintenance",
                routeWeight: 0,
                actualTrafficShare: 0,
                uptime24h: 99.82,
                latencyP50: 0,
                latencyP95: 0,
                errorRate: 0,
                trend: "maintenance window",
                lastIncident: "Planned maintenance window active",
            },
            grok: { routeWeight: 1, actualTrafficShare: 1 },
        }),
        calibration: buildCalibration(4),
        incidents: [
            {
                id: "tf-040",
                time: "09:00:40",
                provider: "SeeDance API",
                type: "maintenance",
                level: "warning",
                title: "计划维护窗口已开始",
                description: "SeeDance API 权重已置零，视觉与多模态请求迁移至其他可用供应商。",
                action: "暂停新请求路由，保留健康探测。",
                status: "active",
            },
        ],
        gatewaySummary:
            "SeeDance 维护窗口被隔离后，TokenFleet 保留健康探测并继续进行计量校准。当前平均差异率为 0.0013%，大部分 API 已进入收敛状态。",
    },
    {
        frame: 6,
        second: 50,
        headline: "Gemini 出现短时 5xx 波动",
        narrative: "Gemini API 的 5xx 错误率短时上升，网关触发重试和熔断保护，将部分请求转交给 OpenAI 与 GLM。",
        summaryMetrics: {
            gatewayHealth: "Degraded",
            providersOnline: "8 / 9",
            avgLatency: 318,
            requestsToday: 912460,
            tokensToday: 1208400000,
            activeIncidents: 3,
        },
        providers: buildProviders({
            openai: { routeWeight: 27, actualTrafficShare: 27, requestsToday: 195620, tokensToday: 255300000 },
            claude: {
                status: "degraded",
                routeWeight: 8,
                actualTrafficShare: 8,
                latencyP50: 510,
                latencyP95: 1240,
                errorRate: 0.14,
                trend: "recovering",
                lastIncident: "Reduced traffic while latency recovers",
            },
            gemini: {
                status: "degraded",
                routeWeight: 10,
                actualTrafficShare: 11,
                latencyP50: 424,
                latencyP95: 1098,
                requestsToday: 142260,
                tokensToday: 187200000,
                errorRate: 1.86,
                costToday: 2248,
                trend: "5xx spike",
                lastIncident: "Transient 5xx protection active",
            },
            deepseek: { routeWeight: 18, actualTrafficShare: 18, requestsToday: 118120, tokensToday: 164200000 },
            kimi: { routeWeight: 15, actualTrafficShare: 15, requestsToday: 105460, tokensToday: 147000000 },
            minimax: { routeWeight: 9, actualTrafficShare: 9 },
            zhipu: { routeWeight: 12, actualTrafficShare: 11, requestsToday: 74220, tokensToday: 99100000 },
            seedance: {
                status: "maintenance",
                routeWeight: 0,
                actualTrafficShare: 0,
                uptime24h: 99.82,
                latencyP50: 0,
                latencyP95: 0,
                errorRate: 0,
                trend: "maintenance window",
                lastIncident: "Planned maintenance window active",
            },
            grok: { routeWeight: 1, actualTrafficShare: 1 },
        }),
        calibration: buildCalibration(5),
        incidents: [
            {
                id: "tf-050",
                time: "09:00:50",
                provider: "Gemini API / Google",
                type: "error-rate",
                level: "critical",
                title: "短时 5xx 错误率波动",
                description: "Gemini API 错误率升至 1.86%，超过熔断保护阈值。",
                action: "降低路由权重，启用幂等重试并转移部分请求。",
                status: "active",
            },
        ],
        gatewaySummary:
            "TokenFleet 在 Claude 延迟、SeeDance 维护和 Gemini 5xx 波动期间持续校准实际用量与计价用量。当前平均差异率已收敛至 0.0009%，进入十万分之一级校准区间。",
    },
    {
        frame: 7,
        second: 60,
        headline: "成本守护策略触发，批量任务转向国产模型池",
        narrative: "成本守护器检测到国际模型成本曲线上行，将批量摘要、标签生成和低优先级补全任务转向中国模型池。",
        summaryMetrics: {
            gatewayHealth: "Degraded",
            providersOnline: "8 / 9",
            avgLatency: 296,
            requestsToday: 920320,
            tokensToday: 1219800000,
            activeIncidents: 3,
        },
        providers: buildProviders({
            openai: { routeWeight: 21, actualTrafficShare: 21, requestsToday: 197340, tokensToday: 257600000, costToday: 4072 },
            claude: {
                status: "degraded",
                routeWeight: 7,
                actualTrafficShare: 7,
                latencyP50: 472,
                latencyP95: 1112,
                requestsToday: 151040,
                tokensToday: 199500000,
                errorRate: 0.13,
                costToday: 4188,
                trend: "recovering",
                lastIncident: "Reduced traffic while latency recovers",
            },
            gemini: {
                status: "degraded",
                routeWeight: 8,
                actualTrafficShare: 8,
                latencyP50: 396,
                latencyP95: 990,
                errorRate: 0.94,
                trend: "error rate easing",
                lastIncident: "Transient 5xx protection active",
            },
            deepseek: {
                routeWeight: 24,
                actualTrafficShare: 24,
                requestsToday: 124820,
                tokensToday: 174800000,
                tokensMonth: 3319000000,
                costToday: 934,
                trend: "cost optimized",
            },
            kimi: {
                routeWeight: 19,
                actualTrafficShare: 19,
                requestsToday: 111980,
                tokensToday: 157800000,
                tokensMonth: 2947000000,
                costToday: 882,
                trend: "cost optimized",
            },
            minimax: {
                routeWeight: 10,
                actualTrafficShare: 10,
                requestsToday: 84320,
                tokensToday: 111100000,
                costToday: 734,
                trend: "cost optimized",
            },
            zhipu: {
                routeWeight: 10,
                actualTrafficShare: 10,
                requestsToday: 77240,
                tokensToday: 104800000,
                costToday: 682,
                trend: "cost optimized",
            },
            seedance: {
                status: "maintenance",
                routeWeight: 0,
                actualTrafficShare: 0,
                uptime24h: 99.82,
                latencyP50: 0,
                latencyP95: 0,
                errorRate: 0,
                trend: "maintenance window",
                lastIncident: "Planned maintenance window active",
            },
            grok: { routeWeight: 1, actualTrafficShare: 1 },
        }),
        calibration: buildCalibration(6),
        incidents: [
            {
                id: "tf-060",
                time: "09:01:00",
                provider: "Gateway",
                type: "cost-control",
                level: "info",
                title: "成本守护策略已触发",
                description: "批量任务和低优先级补全请求已转向 DeepSeek、Kimi、MiniMax 与 GLM。",
                action: "保持高优先级请求质量权重，压低批量任务单位成本。",
                status: "applied",
            },
        ],
        gatewaySummary:
            "可信计量进入主力 API 精准同步阶段，平均差异率为 0.0007%。实际转接用量与供应商计价用量高度贴合，可支撑高精度算力结算与多供应商对账。",
    },
    {
        frame: 8,
        second: 70,
        headline: "Claude 延迟恢复，系统逐步恢复路由权重",
        narrative: "Claude API 连续三个采样窗口回到健康延迟区间，网关按阶梯恢复策略逐步提高其路由权重。",
        summaryMetrics: {
            gatewayHealth: "Recovering",
            providersOnline: "8 / 9",
            avgLatency: 288,
            requestsToday: 928140,
            tokensToday: 1231300000,
            activeIncidents: 2,
        },
        providers: buildProviders({
            openai: { routeWeight: 22, actualTrafficShare: 22, requestsToday: 199280, tokensToday: 260200000 },
            claude: {
                status: "healthy",
                routeWeight: 13,
                actualTrafficShare: 12,
                uptime24h: 99.97,
                latencyP50: 366,
                latencyP95: 876,
                requestsToday: 153820,
                tokensToday: 203100000,
                errorRate: 0.11,
                costToday: 4244,
                trend: "recovering weight",
                lastIncident: "Latency recovered; staged route restore",
            },
            gemini: {
                status: "degraded",
                routeWeight: 9,
                actualTrafficShare: 9,
                latencyP50: 360,
                latencyP95: 884,
                errorRate: 0.46,
                trend: "error rate easing",
                lastIncident: "Transient 5xx protection active",
            },
            deepseek: { routeWeight: 22, actualTrafficShare: 22, requestsToday: 129680, tokensToday: 182100000 },
            kimi: { routeWeight: 18, actualTrafficShare: 18, requestsToday: 116240, tokensToday: 164400000 },
            minimax: { routeWeight: 9, actualTrafficShare: 9, requestsToday: 86320, tokensToday: 114300000 },
            zhipu: { routeWeight: 8, actualTrafficShare: 8, requestsToday: 79060, tokensToday: 107200000 },
            seedance: {
                status: "maintenance",
                routeWeight: 0,
                actualTrafficShare: 0,
                uptime24h: 99.82,
                latencyP50: 0,
                latencyP95: 0,
                errorRate: 0,
                trend: "maintenance window",
                lastIncident: "Planned maintenance window active",
            },
            grok: { routeWeight: 1, actualTrafficShare: 1 },
        }),
        calibration: buildCalibration(7),
        incidents: [
            {
                id: "tf-070",
                time: "09:01:10",
                provider: "Claude API / Anthropic",
                type: "recovery",
                level: "resolved",
                title: "延迟恢复到健康区间",
                description: "Claude API P95 延迟回落至 876 ms，恢复策略开始分阶段提高权重。",
                action: "以阶梯方式恢复路由，避免瞬时回流。",
                status: "recovering",
            },
        ],
        gatewaySummary:
            "Claude API 恢复后，系统稳定在十万分之一量级校准区间。当前平均差异率为 0.0006%，路由恢复不会打断实际用量与计价用量同步。",
    },
    {
        frame: 9,
        second: 80,
        headline: "整体恢复稳定，网关生成策略总结",
        narrative: "多路由策略完成一次延迟、维护、错误率和成本事件的联合处置，所有可用供应商回到稳定分发状态。",
        summaryMetrics: {
            gatewayHealth: "Healthy",
            providersOnline: "9 / 9",
            avgLatency: 301,
            requestsToday: 936420,
            tokensToday: 1243200000,
            activeIncidents: 0,
        },
        providers: buildProviders({
            openai: { routeWeight: 22, actualTrafficShare: 22, requestsToday: 201360, tokensToday: 263100000, costToday: 4216 },
            claude: {
                status: "healthy",
                routeWeight: 16,
                actualTrafficShare: 15,
                latencyP50: 348,
                latencyP95: 838,
                requestsToday: 156240,
                tokensToday: 206800000,
                errorRate: 0.1,
                costToday: 4308,
                trend: "stable",
                lastIncident: "Recovered and monitored",
            },
            gemini: {
                status: "healthy",
                routeWeight: 15,
                actualTrafficShare: 15,
                latencyP50: 326,
                latencyP95: 802,
                requestsToday: 145520,
                tokensToday: 192200000,
                errorRate: 0.13,
                costToday: 2306,
                trend: "stable",
                lastIncident: "5xx spike resolved",
            },
            deepseek: {
                routeWeight: 16,
                actualTrafficShare: 16,
                requestsToday: 133840,
                tokensToday: 188400000,
                costToday: 972,
                trend: "stable",
            },
            kimi: {
                routeWeight: 13,
                actualTrafficShare: 13,
                requestsToday: 119840,
                tokensToday: 169900000,
                costToday: 914,
                trend: "stable",
            },
            minimax: { routeWeight: 8, actualTrafficShare: 8, requestsToday: 88420, tokensToday: 117700000 },
            zhipu: { routeWeight: 7, actualTrafficShare: 7, requestsToday: 80940, tokensToday: 109800000 },
            seedance: {
                status: "healthy",
                routeWeight: 2,
                actualTrafficShare: 2,
                uptime24h: 99.84,
                latencyP50: 334,
                latencyP95: 826,
                errorRate: 0.12,
                trend: "restored",
                lastIncident: "Maintenance completed",
            },
            grok: { routeWeight: 1, actualTrafficShare: 1 },
        }),
        calibration: buildCalibration(8),
        incidents: [
            {
                id: "tf-080",
                time: "09:01:20",
                provider: "Gateway",
                type: "summary",
                level: "resolved",
                title: "联合处置策略完成",
                description: "延迟恢复、错误率回落、维护窗口结束，成本守护策略保留为日间优化基线。",
                action: "输出策略总结并回到稳定观察。",
                status: "resolved",
            },
        ],
        gatewaySummary:
            "TokenFleet 已完成可信计量闭环。当前平均差异率为 0.0005%，实际用量与计价用量稳定贴合，可用于高精度算力结算、成本核对与多供应商对账。",
    },
];

export const timeline = rawTimeline.map((frame, index) => ({
    ...frame,
    billingMetrics: billingMetricFrames[index],
    calibrationSeries: buildCalibrationSeries(index),
    agentMetrics: agentMetricFrames[index],
    routingSeries: buildRoutingSeries(index),
    fairnessEvents: buildFairnessEvents(index),
    workflowRouting: buildWorkflowRouting(index),
}));

export default timeline;
