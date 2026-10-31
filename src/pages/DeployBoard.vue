<template>
    <div class="deploy-board" :class="{ 'is-dark': $root.isDark, 'is-wall': wall }">
        <div v-if="!$root.loggedIn" class="db-login">
            <Login v-if="$root.allowLoginDialog" />
        </div>

        <div v-else-if="notFound" class="db-notfound">
            <p>{{ $t("deployBoardNotFound", [slug]) }}</p>
        </div>

        <div v-else class="db-shell">
            <header class="db-top">
                <div class="db-ident">
                    <span class="db-eyebrow">{{ $t("deployBoardEyebrow") }}</span>
                    <h1 class="db-title">{{ $t("deployBoardTitle") }}</h1>
                    <span v-if="pageTitle" class="db-page-name">{{ pageTitle }}</span>
                </div>

                <div class="db-verdict" :data-tone="servicesVerdict.tone">
                    <span class="db-verdict-dot"></span>
                    <span class="db-verdict-key">{{ $t("deployBoardServices") }}</span>
                    <span class="db-verdict-title">{{ servicesVerdict.title }}</span>
                    <span class="db-verdict-sub">{{ servicesVerdict.sub }}</span>
                </div>

                <div class="db-verdict" :data-tone="deploysVerdict.tone">
                    <span class="db-verdict-dot"></span>
                    <span class="db-verdict-key">{{ $t("deployBoardDeploys") }}</span>
                    <span class="db-verdict-title">{{ deploysVerdict.title }}</span>
                    <span class="db-verdict-sub">{{ deploysVerdict.sub }}</span>
                </div>

                <div class="db-clock">
                    <span class="db-clock-time">{{ clockTime }}</span>
                    <span class="db-clock-date">{{ clockDate }}</span>
                </div>
            </header>

            <main class="db-main">
                <DeployColumn :board="board" />

                <section
                    class="db-services"
                    :class="{ 'is-stale': !kumaConnected }"
                    :aria-label="$t('deployBoardServices')"
                >
                    <div class="db-services-head">
                        <h2 class="db-section-title">{{ $t("deployBoardServices") }}</h2>
                        <span class="db-legend">
                            <span class="db-legend-item is-up">{{ $t("deployBoardStatusUp") }}</span>
                            <span class="db-legend-item is-pending">{{ $t("deployBoardStatusPending") }}</span>
                            <span class="db-legend-item is-down">{{ $t("deployBoardStatusDown") }}</span>
                            <span class="db-legend-item is-maintenance">{{ $t("deployBoardStatusMaintenance") }}</span>
                            <span>{{ $t("deployBoardBeatsHint") }}</span>
                        </span>
                        <span v-if="paging.pages > 1" class="db-page">
                            {{ $t("deployBoardPage", [paging.page, paging.pages]) }}
                        </span>
                    </div>

                    <p v-if="!kumaConnected" class="db-warning">{{ $t("deployBoardKumaNoReadDetail") }}</p>
                    <p v-else-if="curationFailed" class="db-warning">{{ $t("deployBoardCurationFailed") }}</p>

                    <div class="db-services-body">
                        <IncidentBlock v-if="promoted.length" :monitors="promoted" />
                        <MonitorGrid :monitors="gridMonitors" :fill="wall" @paging="paging = $event" />
                    </div>
                </section>
            </main>

            <SourcesFooter
                :sources="board ? board.sources : null"
                :kuma-connected="kumaConnected"
                :now="now"
                :format-duration="formatDuration"
            />
        </div>
    </div>
</template>

<script>
import axios from "axios";
import dayjs from "dayjs";
import Login from "../components/Login.vue";
import MonitorGrid from "../components/deploy-board/MonitorGrid.vue";
import IncidentBlock from "../components/deploy-board/IncidentBlock.vue";
import DeployColumn from "../components/deploy-board/DeployColumn.vue";
import SourcesFooter from "../components/deploy-board/SourcesFooter.vue";
import { UP, DOWN, PENDING, MAINTENANCE } from "../util.ts";

/**
 * How often the list of monitors is read again from the status page. Matches the 5-minute cache of
 * /api/status-page/:slug: reading more often would only get the same copy.
 */
const CURATION_MS = 5 * 60 * 1000;

/** Heartbeat bars per monitor. */
const BEATS = 24;

/** Board requests refused (socket not logged in yet) are retried this many times, this far apart. */
const BOARD_RETRIES = 5;
const BOARD_RETRY_MS = 2000;

/** Width from which the board is a one-screen wall layout. Mirrors the media query below. */
const WALL_QUERY = "(min-width: 1180px)";

/** Kuma heartbeat status → tone used by the board. */
const TONES = {
    [UP]: "up",
    [PENDING]: "pending",
    [DOWN]: "down",
    [MAINTENANCE]: "maintenance",
};

export default {
    components: {
        Login,
        MonitorGrid,
        IncidentBlock,
        DeployColumn,
        SourcesFooter,
    },

    data() {
        return {
            slug: "",
            pageTitle: "",
            curated: [],
            curationLoaded: false,
            curationFailed: false,
            notFound: false,
            board: null,
            now: Date.now(),
            wall: window.matchMedia(WALL_QUERY).matches,
            paging: { page: 1, pages: 1 },
        };
    },

    computed: {
        /** @returns {boolean} Whether the socket to Kuma is up */
        kumaConnected() {
            return !!this.$root.socket?.connected;
        },

        /** @returns {object[]} Curated monitors with their live state */
        monitors() {
            return this.curated.map((entry) => this.liveMonitor(entry));
        },

        /** @returns {object[]} Down and pending monitors, promoted above the grid */
        promoted() {
            return this.monitors
                .filter((m) => m.tone === "down" || m.tone === "pending")
                .sort((a, b) => (a.tone === b.tone ? (a.since || 0) - (b.since || 0) : a.tone === "down" ? -1 : 1))
                .map((m) => ({
                    ...m,
                    stateText: m.since
                        ? this.$t("deployBoardStateFor", [m.label, this.formatDuration(this.now - m.since)])
                        : m.label,
                }));
        },

        /** @returns {object[]} Monitors that stay in the grid */
        gridMonitors() {
            return this.monitors.filter((m) => m.tone !== "down" && m.tone !== "pending");
        },

        /** @returns {{tone: string, title: string, sub: string}} Services verdict of the top bar */
        servicesVerdict() {
            if (!this.kumaConnected) {
                return {
                    tone: "muted",
                    title: this.$t("deployBoardKumaNoRead"),
                    sub: this.$t("deployBoardKumaNoReadDetail"),
                };
            }
            if (!this.curationLoaded) {
                return { tone: "muted", title: this.$t("deployBoardReading"), sub: "" };
            }
            const down = this.monitors.filter((m) => m.tone === "down");
            const pending = this.monitors.filter((m) => m.tone === "pending");
            if (down.length) {
                return { tone: "bad", title: this.$t("deployBoardServicesDown", [down.length]), sub: names(down) };
            }
            if (pending.length) {
                return {
                    tone: "warn",
                    title: this.$t("deployBoardServicesPending", [pending.length]),
                    sub: names(pending),
                };
            }
            const up = this.monitors.filter((m) => m.tone === "up").length;
            const maintenance = this.monitors.filter((m) => m.tone === "maintenance").length;
            const sub = maintenance
                ? this.$t("deployBoardServicesSummaryMaintenance", [up, this.monitors.length, maintenance])
                : this.$t("deployBoardServicesSummary", [up, this.monitors.length]);
            return { tone: "ok", title: this.$t("deployBoardServicesAllUp"), sub };
        },

        /** @returns {{tone: string, title: string, sub: string}} Deploys verdict of the top bar */
        deploysVerdict() {
            if (!this.board) {
                return { tone: "muted", title: this.$t("deployBoardReading"), sub: "" };
            }
            const anyOn = Object.values(this.board.sources).some((s) => s.state !== "unconfigured");
            if (!anyOn) {
                return { tone: "muted", title: this.$t("deployBoardNoSourcesShort"), sub: "" };
            }
            return { tone: "ok", title: this.$t("deployBoardNoDeploys"), sub: "" };
        },

        /** @returns {string} Wall clock */
        clockTime() {
            return dayjs(this.now).format("HH:mm:ss");
        },

        /** @returns {string} Today's date, in the UI language */
        clockDate() {
            return new Date(this.now).toLocaleDateString(this.$i18n.locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
            });
        },
    },

    watch: {
        "$root.loggedIn": {
            handler(loggedIn) {
                if (!loggedIn) {
                    return;
                }
                if (this.reading) {
                    // Logged in again on the same page: what was on screen is from the old session.
                    this.requestBoard();
                    this.fetchCuration();
                } else {
                    this.startReading();
                }
            },
            immediate: true,
        },

        // After a reconnect the server does not push the board by itself: ask again.
        kumaConnected(connected) {
            if (connected && this.$root.loggedIn) {
                this.requestBoard();
            }
        },
    },

    mounted() {
        document.body.classList.add("deploy-board-body");
        this.slug = String(this.$route.params.slug || "").toLowerCase();
        this.clockTimer = setInterval(() => {
            this.now = Date.now();
        }, 1000);
        this.wallQuery = window.matchMedia(WALL_QUERY);
        this.onWallChange = (e) => {
            this.wall = e.matches;
        };
        this.wallQuery.addEventListener("change", this.onWallChange);
    },

    beforeUnmount() {
        document.body.classList.remove("deploy-board-body");
        clearInterval(this.clockTimer);
        clearInterval(this.curationTimer);
        clearTimeout(this.boardRetryTimer);
        this.wallQuery?.removeEventListener("change", this.onWallChange);
        if (this.onBoardUpdate) {
            this.$root.getSocket()?.off("deployBoardUpdate", this.onBoardUpdate);
        }
    },

    methods: {
        /**
         * Start reading once logged in. Nothing about deploys or monitors is fetched before.
         * @returns {void}
         */
        startReading() {
            if (this.reading) {
                return;
            }
            this.reading = true;
            this.slug = String(this.$route.params.slug || "").toLowerCase();

            this.onBoardUpdate = (snapshot) => {
                this.board = snapshot;
            };
            this.$root.getSocket().on("deployBoardUpdate", this.onBoardUpdate);
            this.requestBoard();

            this.fetchCuration();
            this.curationTimer = setInterval(this.fetchCuration, CURATION_MS);
        },

        /**
         * Ask the server for the whole board state.
         *
         * Retries a refusal a few times: after a reconnect the client sends `loginByToken` first, but
         * the server finishes it asynchronously, so a request sent right behind it can arrive before
         * the socket is logged in again. Without the retry the board stays stale until the next change.
         * @param {number} attempt Attempt number, starting at 0.
         * @returns {void}
         */
        requestBoard(attempt = 0) {
            clearTimeout(this.boardRetryTimer);
            this.$root.getSocket().emit("getDeployBoard", (res) => {
                if (res && res.ok) {
                    this.board = res.board;
                } else if (attempt < BOARD_RETRIES && this.$root.loggedIn) {
                    this.boardRetryTimer = setTimeout(() => this.requestBoard(attempt + 1), BOARD_RETRY_MS);
                }
            });
        },

        /**
         * Read which monitors the status page shows, in its order. A failed read keeps the last list.
         * @returns {void}
         */
        fetchCuration() {
            axios
                .get(`/api/status-page/${encodeURIComponent(this.slug)}`)
                .then((res) => {
                    if (!res.data?.config?.published) {
                        this.notFound = true;
                        return;
                    }
                    this.pageTitle = res.data.config.title || "";
                    this.curated = curatedMonitors(res.data.publicGroupList || []);
                    this.curationLoaded = true;
                    this.curationFailed = false;
                    this.notFound = false;
                })
                .catch((error) => {
                    if (error.response && error.response.status === 404) {
                        this.notFound = true;
                    } else {
                        this.curationFailed = true;
                    }
                });
        },

        /**
         * One curated monitor with its live state from the socket.
         * @param {{id: number, name: string}} entry Curated monitor.
         * @returns {object} { id, name, tone, label, since, beats }
         */
        liveMonitor(entry) {
            const monitor = this.$root.monitorList[entry.id];
            const list = this.$root.heartbeatList[entry.id] || [];
            const last = list[list.length - 1];

            let tone;
            if (monitor && !monitor.active) {
                tone = "paused";
            } else if (last && TONES[last.status]) {
                tone = TONES[last.status];
            } else {
                tone = "unknown";
            }

            return {
                id: entry.id,
                name: monitor?.name || entry.name,
                tone,
                label: this.$t(LABEL_KEYS[tone]),
                since: last ? sinceOf(list) : null,
                beats: beatsOf(list),
            };
        },

        /**
         * Short duration: "12 s", "3 min", "1 h 05 min".
         * @param {number} ms Milliseconds.
         * @returns {string} Formatted duration.
         */
        formatDuration(ms) {
            const seconds = Math.max(0, Math.round(ms / 1000));
            if (seconds < 60) {
                return `${seconds} s`;
            }
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) {
                return `${minutes} min`;
            }
            return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
        },
    },
};

/** Tone → i18n key of its label. */
const LABEL_KEYS = {
    up: "deployBoardStatusUp",
    pending: "deployBoardStatusPending",
    down: "deployBoardStatusDown",
    maintenance: "deployBoardStatusMaintenance",
    paused: "deployBoardStatusPaused",
    unknown: "deployBoardStatusUnknown",
};

/**
 * Monitors of the status page, in its order. A group shown with its children is replaced by them,
 * like on the status page itself; a monitor listed twice appears once.
 * @param {object[]} groups publicGroupList of /api/status-page/:slug.
 * @returns {{id: number, name: string}[]} Curated monitors.
 */
function curatedMonitors(groups) {
    const out = [];
    const seen = new Set();
    const add = (id, name) => {
        if (!seen.has(id)) {
            seen.add(id);
            out.push({ id, name });
        }
    };
    for (const group of groups) {
        for (const monitor of group.monitorList || []) {
            if (monitor.showChildren && Array.isArray(monitor.childrenList)) {
                for (const child of monitor.childrenList) {
                    add(child.id, child.name);
                }
            } else {
                add(monitor.id, monitor.name);
            }
        }
    }
    return out;
}

/**
 * When the current state began: the oldest heartbeat of the latest run of equal statuses.
 * Bounded by what the socket delivered, so for long states it is "at least since".
 * @param {object[]} list Heartbeats, oldest first.
 * @returns {number|null} Epoch ms.
 */
function sinceOf(list) {
    if (!list.length) {
        return null;
    }
    const status = list[list.length - 1].status;
    let i = list.length - 1;
    while (i > 0 && list[i - 1].status === status) {
        i--;
    }
    const time = dayjs.utc(list[i].time);
    return time.isValid() ? time.valueOf() : null;
}

/**
 * The last BEATS statuses as tones, oldest first, padded on the left when there are fewer.
 * @param {object[]} list Heartbeats, oldest first.
 * @returns {string[]} Tones ("empty" for padding).
 */
function beatsOf(list) {
    const tail = list.slice(-BEATS).map((hb) => TONES[hb.status] || "empty");
    return Array(BEATS - tail.length)
        .fill("empty")
        .concat(tail);
}

/**
 * @param {object[]} monitors Monitors.
 * @returns {string} Their names, comma separated.
 */
function names(monitors) {
    return monitors.map((m) => m.name).join(", ");
}
</script>

<!-- The @font-face rules stay out of the scoped block: at-rules are not scoped. Same file as the TV panel. -->
<!-- eslint-disable-next-line vue-scoped-css/enforce-style-type -->
<style>
@import "../assets/fonts/plus-jakarta-sans.css";

/* Kuma's heartbeat toasts would sit on top of the monitors of a wall screen; the board already
   promotes every outage to its highlight block. Only while this page is open. */
/* stylelint-disable-next-line selector-class-pattern -- class name owned by vue-toastification */
body.deploy-board-body .Vue-Toastification__container {
    display: none;
}
</style>

<style lang="scss" scoped>
/* Layout: deploys in a narrow column on the left, the status page monitors filling the rest. */
.deploy-board {
    --db-bg: #f4f2f6;
    --db-panel: #fff;
    --db-panel-2: #f0edf3;
    --db-line: #e3dee8;
    --db-line-2: #d2ccd8;
    --db-ink: #1c1921;
    --db-ink-2: #565060;
    --db-ink-3: #77717f;
    --db-brand: #b11e58;
    --db-ok: #157a3b;
    --db-ok-soft: #e2f3e8;
    --db-warn: #9a5806;
    --db-warn-soft: #fbeed6;
    --db-bad: #c42828;
    --db-bad-soft: #fbe3e3;
    --db-maint: #535e8d;
    --db-maint-soft: #e8eaf4;
    --db-gap: 8px;

    position: fixed;
    inset: 0;
    z-index: 1;
    overflow-x: hidden;
    overflow-y: auto;
    background: var(--db-bg);
    color: var(--db-ink);
    font-family:
        "Plus Jakarta Sans",
        system-ui,
        -apple-system,
        "Segoe UI",
        Roboto,
        Arial,
        sans-serif;
    font-size: clamp(14px, calc(0.45vw + 8px), 19px);
    line-height: 1.35;
    -webkit-font-smoothing: antialiased;

    &.is-dark {
        --db-bg: #110f14;
        --db-panel: #1a171e;
        --db-panel-2: #231f28;
        --db-line: #2e2934;
        --db-line-2: #3d3744;
        --db-ink: #efecf2;
        --db-ink-2: #aca5b4;
        --db-ink-3: #7f7887;
        --db-brand: #ea7aa5;
        --db-ok: #3cc784;
        --db-ok-soft: #15301f;
        --db-warn: #eaae42;
        --db-warn-soft: #35290f;
        --db-bad: #f2625f;
        --db-bad-soft: #3b1a1c;
        --db-maint: #959ec7;
        --db-maint-soft: #23263a;

        color-scheme: dark;
    }
}

.db-login,
.db-notfound {
    display: grid;
    place-items: center;
    min-height: 100%;
    padding: 2em max(16px, env(safe-area-inset-right, 0px)) 2em max(16px, env(safe-area-inset-left, 0px));
}

.db-shell {
    display: flex;
    flex-direction: column;
    gap: 0.9em;
    min-height: 100%;
    padding-block: 0.9em;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
}

.db-top {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0.7em 1em;
}

.db-ident {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.2em;
    margin-right: auto;
    min-width: 0;
}

.db-eyebrow {
    font-size: 0.78em;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--db-brand);
}

.db-title {
    margin: 0;
    font-size: 1.8em;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.05;
}

.db-page-name {
    font-size: 0.85em;
    color: var(--db-ink-3);
}

.db-verdict {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 0.8em;
    align-content: center;
    flex: 1 1 18em;
    max-width: 30em;
    min-width: 0;
    padding: 0.6em 1.1em;
    background: var(--db-panel);
    border: 1px solid var(--db-line);
    border-radius: 10px;
}

.db-verdict-dot {
    grid-row: 1 / 4;
    align-self: center;
    width: 0.9em;
    height: 0.9em;
    border-radius: 50%;
    background: var(--db-ok);
    box-shadow: 0 0 0 0.3em var(--db-ok-soft);
}

.db-verdict-key {
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--db-ink-3);
}

.db-verdict-title {
    font-size: 1.35em;
    font-weight: 800;
    line-height: 1.15;
}

.db-verdict-sub {
    font-size: 0.88em;
    color: var(--db-ink-2);
    overflow-wrap: anywhere;
}

.db-verdict[data-tone="warn"] {
    .db-verdict-dot {
        background: var(--db-warn);
        box-shadow: 0 0 0 0.3em var(--db-warn-soft);
    }

    .db-verdict-title {
        color: var(--db-warn);
    }
}

.db-verdict[data-tone="bad"] {
    .db-verdict-dot {
        background: var(--db-bad);
        box-shadow: 0 0 0 0.3em var(--db-bad-soft);
    }

    .db-verdict-title {
        color: var(--db-bad);
    }
}

.db-verdict[data-tone="muted"] {
    .db-verdict-dot {
        background: var(--db-ink-3);
        box-shadow: 0 0 0 0.3em var(--db-panel-2);
    }

    .db-verdict-title {
        color: var(--db-ink-2);
    }
}

.db-clock {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
    gap: 0.15em;
}

.db-clock-time {
    font-size: 1.7em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
}

.db-clock-date {
    font-size: 0.85em;
    color: var(--db-ink-3);
}

.db-main {
    display: flex;
    flex-direction: column;
    gap: 1.2em;
    min-width: 0;
}

.db-services {
    display: flex;
    flex-direction: column;
    gap: 0.6em;
    min-width: 0;
    min-height: 0;

    &.is-stale .db-services-body {
        opacity: 0.4;
        filter: grayscale(0.7);
    }
}

.db-services-body {
    display: flex;
    flex-direction: column;
    gap: 0.6em;
}

.db-services-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.3em 1.2em;
}

.db-section-title {
    margin: 0;
    font-size: 0.8em;
    font-weight: 800;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--db-ink-2);
}

.db-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3em 0.9em;
    font-size: 0.8em;
    color: var(--db-ink-3);
}

.db-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;

    &::before {
        content: "";
        width: 0.6em;
        height: 0.6em;
        border-radius: 2px;
        background: var(--db-ok);
    }

    &.is-pending::before {
        background: var(--db-warn);
    }

    &.is-down::before {
        background: var(--db-bad);
    }

    &.is-maintenance::before {
        background: var(--db-maint);
    }
}

.db-page {
    margin-left: auto;
    font-size: 0.82em;
    font-weight: 700;
    color: var(--db-ink-2);
    font-variant-numeric: tabular-nums;
}

.db-warning {
    margin: 0;
    font-weight: 700;
    color: var(--db-warn);
}

/* Wall layout: one screen, no scroll, two columns; the grid measures the space it gets. */
@media (min-width: 1180px) {
    .deploy-board {
        overflow: hidden;
    }

    .db-shell {
        height: 100%;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
    }

    .db-main {
        display: grid;
        grid-template-columns: minmax(26em, 30%) minmax(0, 1fr);
        gap: 1.4em;
        min-height: 0;
    }

    .db-services-body {
        flex: 1 1 0;
        min-height: 0;
    }
}

@media (max-width: 680px) {
    .db-verdict {
        flex-basis: 100%;
        max-width: none;
    }

    .db-clock {
        align-items: flex-start;
    }
}
</style>
