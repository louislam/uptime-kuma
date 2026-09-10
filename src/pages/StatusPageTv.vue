<template>
    <div class="tv-stage">
        <div class="tv-frame" :style="frameStyle">
            <!-- Cabeçalho -->
            <header class="tv-header">
                <div class="tv-header__identity">
                    <p class="tv-eyebrow">{{ $t("tvPanelEyebrow") }}</p>
                    <h1 class="tv-title">{{ heading }}</h1>
                </div>
                <div class="tv-header__clock">
                    <p :class="{ 'tv-header__stale': loaded && leituraFalhou }">
                        {{ $t("tvPanelUpdated", [lastUpdateText])
                        }}<span v-if="loaded && leituraFalhou"> · {{ $t("tvPanelStale") }}</span>
                    </p>
                    <p>{{ $t("tvPanelNextRead", [countdownText]) }}</p>
                </div>
            </header>

            <!-- Bloco de destaque: quem está fora do ar -->
            <section v-if="downMonitors.length > 0" class="tv-alert" :class="{ 'tv-alert--pulsing': pulsing }">
                <div class="tv-alert__band" :class="{ 'tv-alert__band--pulsing': pulsing }">
                    <!-- Onda contínua enquanto houver queda, e não só durante o pulso: passados os
                         30 s o bloco ficava imóvel, que é quando uma queda vira paisagem e some da
                         atenção de quem passa pela sala. -->
                    <div class="tv-wave" :class="{ 'tv-wave--pulsing': pulsing }" aria-hidden="true">
                        <svg class="tv-wave__layer tv-wave__layer--back" viewBox="0 0 1200 120" preserveAspectRatio="none">
                            <path
                                vector-effect="non-scaling-stroke"
                                d="M0,60 q150,-76 300,0 t300,0 t300,0 t300,0"
                            />
                        </svg>
                        <svg class="tv-wave__layer tv-wave__layer--mid" viewBox="0 0 1200 120" preserveAspectRatio="none">
                            <path
                                vector-effect="non-scaling-stroke"
                                d="M0,60 q150,-56 300,0 t300,0 t300,0 t300,0"
                            />
                        </svg>
                        <svg class="tv-wave__layer tv-wave__layer--front" viewBox="0 0 1200 120" preserveAspectRatio="none">
                            <path
                                vector-effect="non-scaling-stroke"
                                d="M0,60 q150,-38 300,0 t300,0 t300,0 t300,0"
                            />
                        </svg>
                    </div>
                    <span class="tv-alert__dot"></span>
                    <p class="tv-alert__title">
                        {{ downMonitors.length === 1 ? $t("tvPanelServiceDown") : $t("tvPanelServicesDown") }}
                    </p>
                    <p class="tv-alert__count">
                        {{ $t("tvPanelDownCount", [downMonitors.length, monitors.length]) }}
                    </p>
                </div>

                <!-- Uma queda: card grande com o histórico inteiro -->
                <div v-if="downMonitors.length === 1" class="tv-alert__single">
                    <div class="tv-alert__headline">
                        <h2>{{ downMonitors[0].name }}</h2>
                        <div class="tv-pill">
                            <span class="tv-pill__dot"></span>
                            <p>{{ downMonitors[0].errorLabel }}</p>
                        </div>
                    </div>
                    <div class="tv-history">
                        <p class="tv-history__label">
                            {{ $t("tvPanelHistory", [historyWindow(downMonitors[0])]) }}
                        </p>
                        <div class="tv-bars tv-bars--lg">
                            <div
                                v-for="(beat, index) in paddedBeats(downMonitors[0], HISTORY_LENGTH)"
                                :key="index"
                                class="tv-bar"
                                :class="beatClass(beat)"
                            ></div>
                        </div>
                        <div class="tv-history__axis">
                            <span>{{ historyWindow(downMonitors[0]) }}</span>
                            <span>{{ $t("tvPanelNow") }}</span>
                        </div>
                    </div>
                </div>

                <!-- Várias quedas dentro do teto: grade de cards compactos.
                     Acima do teto os cards saem de cena e a lista assume, com os caídos primeiro:
                     um painel que só resume o excedente ("e mais 23") esconde exatamente o que ele
                     existe para mostrar. -->
                <div v-else-if="!overflowing" class="tv-alert__grid">
                    <div
                        v-for="monitor in downMonitors"
                        :key="monitor.id"
                        class="tv-card"
                        :class="{ 'tv-card--pulsing': isJustChanged(monitor) }"
                    >
                        <div class="tv-card__top">
                            <h3>{{ monitor.name }}</h3>
                            <span v-if="isJustChanged(monitor)" class="tv-badge">{{ $t("tvPanelJustChanged") }}</span>
                        </div>
                        <p class="tv-card__error">{{ monitor.errorLabel }}</p>
                        <div class="tv-bars tv-bars--sm">
                            <div
                                v-for="(beat, index) in paddedBeats(monitor, HISTORY_LENGTH)"
                                :key="index"
                                class="tv-bar"
                                :class="beatClass(beat)"
                            ></div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Sem leitura nenhuma: o lugar do destaque não pode ficar vazio, senão a parede
                 inteira passa por painel de tudo certo. A distinção entre "ainda carregando" e
                 "falhou" é o que impede este aviso de piscar em toda carga de página. -->
            <section v-else-if="!loaded && leituraFalhou" class="tv-blind">
                <span class="tv-blind__dot"></span>
                <div>
                    <p class="tv-blind__title">{{ $t("tvPanelNoRead") }}</p>
                    <p class="tv-blind__hint">{{ $t("tvPanelNoReadHint") }}</p>
                </div>
            </section>

            <!-- Tudo normal -->
            <section v-else-if="loaded" class="tv-ok" :class="{ 'tv-ok--pulsing': pulsing }">
                <span class="tv-ok__dot"></span>
                <p>{{ $t("tvPanelAllOperational") }}</p>
            </section>

            <!-- Lista dos demais -->
            <section class="tv-list">
                <div class="tv-list__head">
                    <h2>{{ $t("tvPanelServices") }}</h2>
                    <p>{{ summary }}</p>
                </div>
                <div ref="grid" class="tv-list__grid">
                    <div v-for="monitor in visibleMonitors" :key="monitor.id" class="tv-row" :class="rowClass(monitor)">
                        <div class="tv-row__marker"></div>
                        <p class="tv-row__name">
                            {{ monitor.name
                            }}<span v-if="monitor.errorLabel" class="tv-row__cause"> · {{ monitor.errorLabel }}</span>
                        </p>
                        <p class="tv-row__status">{{ statusLabel(monitor.status) }}</p>
                        <div class="tv-bars tv-bars--xs">
                            <div
                                v-for="(beat, index) in paddedBeats(monitor, ROW_HISTORY_LENGTH)"
                                :key="index"
                                class="tv-bar"
                                :class="beatClass(beat)"
                            ></div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script>
import axios from "axios";
import dayjs from "dayjs";
import datetime from "../mixins/datetime";
import { UP, DOWN, PENDING, MAINTENANCE } from "../util.ts";

/**
 * Seconds between reads of the situation. Fixed and short on purpose: this is how long an outage
 * can sit on a wall without being on the wall. It is NOT the configured interval — that one
 * reloads the whole screen (see below), and tying detection to it would mean a page set to five
 * minutes takes five minutes to show a service that just died.
 *
 * Thirty seconds costs nothing: the endpoint caches for a minute, but a status change busts that
 * cache on the spot (`apicache.clear()` on an important heartbeat, server/model/monitor.js), so a
 * read that lands after a change gets the change, not the cached copy.
 */
const SITUATION_SECONDS = 30;

/**
 * The configured "Refresh Interval" of the status page reloads the whole screen.
 *
 * This is the one thing on the panel nobody can do from the sofa: a wall TV never picks up a new
 * version of the page by itself. The floor is well above the pulse, because a reload takes the
 * panel off the air for a moment and wipes what it knew — reloading faster than the pulse would
 * swallow the very announcement the panel exists to make.
 */
const RELOAD_SECONDS_DEFAULT = 300;
const RELOAD_SECONDS_MIN = 120;

/** How often the list rotates to the next page. */
const PAGE_MS = 15000;

/**
 * How long a change keeps pulsing.
 *
 * Thirty seconds, not fifteen: nobody watches a wall panel, they glance at it. Fifteen seconds is
 * short enough to fall entirely between two glances, and then the change that the pulse exists to
 * announce is never seen by anyone.
 */
const PULSE_MS = 30000;

/**
 * Cards the highlight block may show at once.
 *
 * The canvas is fixed at 1920x1080 with overflow hidden and the block does not shrink, so beyond a
 * certain count it silently spills past the bottom edge — in exactly the situation the panel exists
 * for. Nine is three rows of three: the vertical budget fits four, but the fourth leaves the list
 * with a single row, and a panel that only shows what is broken stops answering "is the rest fine?".
 */
const MAX_HIGHLIGHT_CARDS = 9;

/** The canvas the panel is drawn on, before it is fitted into the screen. Mirrors .tv-frame. */
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

/** Bars drawn in the highlighted history, and in the compact row history. */
const HISTORY_LENGTH = 45;
const ROW_HISTORY_LENGTH = 22;

export default {
    mixins: [datetime],

    data() {
        return {
            HISTORY_LENGTH,
            ROW_HISTORY_LENGTH,
            slug: "",
            title: "",
            monitors: [],
            loaded: false,
            leituraFalhou: false,
            lastUpdate: null,
            countdown: SITUATION_SECONDS,
            page: 0,
            rows: 5,
            reloadSeconds: RELOAD_SECONDS_DEFAULT,
            pulsing: false,
            changedIds: [],
            previousDownKey: undefined,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
        };
    },

    computed: {
        /** @returns {string} Heading of the panel: the status page title, or a generic fallback */
        heading() {
            return this.title || this.$t("tvPanelTitle");
        },

        /** @returns {object} Inline style that fits the fixed canvas into the window */
        frameStyle() {
            return {
                transform: `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`,
            };
        },

        /** @returns {object[]} Monitors that are down. Maintenance is not an outage. */
        downMonitors() {
            return this.monitors.filter((monitor) => monitor.status === DOWN);
        },

        /**
         * Mass outage: more down monitors than the highlight can show as cards. The cards leave and
         * the list takes over with the down monitors first — a wall panel that answers "what is
         * down?" with "and 23 more" is not answering.
         * @returns {boolean} True when the down set no longer fits the highlight block.
         */
        overflowing() {
            return this.downMonitors.length > MAX_HIGHLIGHT_CARDS;
        },

        /** @returns {object[]} Monitors the list shows: the ones not promoted to the highlight */
        listedMonitors() {
            if (this.downMonitors.length === 0) {
                return this.monitors;
            }

            if (this.overflowing) {
                // Stable sort: broken states first, curation order preserved inside each state.
                return [...this.monitors].sort((a, b) => this.statusRank(a.status) - this.statusRank(b.status));
            }

            return this.monitors.filter((monitor) => monitor.status !== DOWN);
        },

        /** @returns {number} Items per page, from the measured capacity of the grid (2 columns) */
        perPage() {
            return Math.max(2, this.rows * 2);
        },

        /** @returns {number} Total number of pages */
        pageCount() {
            return Math.max(1, Math.ceil(this.listedMonitors.length / this.perPage));
        },

        /** @returns {number} Current page index, wrapped */
        pageIndex() {
            return this.page % this.pageCount;
        },

        /** @returns {object[]} Monitors on the current page. The last page backs up to stay full. */
        visibleMonitors() {
            const start = Math.min(
                this.pageIndex * this.perPage,
                Math.max(0, this.listedMonitors.length - this.perPage)
            );
            return this.listedMonitors.slice(start, start + this.perPage);
        },

        /** @returns {string} Right-hand summary of the list section */
        summary() {
            let base;

            if (!this.loaded) {
                // Nothing read yet: say so instead of counting zero monitors as "all normal".
                return this.leituraFalhou ? this.$t("tvPanelNoRead") : "";
            }

            if (this.downMonitors.length === 0) {
                base = this.$t("tvPanelAllNormal", [this.monitors.length]);
            } else if (this.overflowing) {
                // The list holds everyone, so "other monitors" would miscount what is on screen.
                base = this.$t("tvPanelAllListed", [this.monitors.length]);
            } else {
                base = this.$t("tvPanelRemaining", [this.listedMonitors.length, this.monitors.length]);
            }

            if (this.pageCount > 1) {
                return `${base}  ·  ${this.$t("tvPanelPage", [this.pageIndex + 1, this.pageCount])}`;
            }
            return base;
        },

        /** @returns {string} Clock of the last successful read */
        lastUpdateText() {
            return this.lastUpdate ? this.time(this.lastUpdate) : "--:--:--";
        },

        /** @returns {string} Countdown to the next read, as mm:ss */
        countdownText() {
            const minutes = Math.floor(this.countdown / 60);
            const seconds = this.countdown % 60;
            return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        },
    },

    mounted() {
        this.slug = this.$route.params.slug || "default";

        this.fetchData();

        this.countdownTimer = setInterval(() => {
            this.countdown = this.countdown > 0 ? this.countdown - 1 : 0;
        }, 1000);
        this.pageTimer = setInterval(() => {
            this.page += 1;
        }, PAGE_MS);

        // A TV browser often reports its viewport only after the first paint (its own chrome
        // collapses, the launcher hands over the screen), and not every one of them fires `resize`
        // when that happens. The late refit costs nothing and is what keeps the panel centred.
        window.addEventListener("resize", this.fit);
        window.addEventListener("orientationchange", this.fit);
        this.refitTimer = setTimeout(this.fit, 1500);

        document.body.classList.add("tv-panel-body");

        this.fit();
        this.$nextTick(() => requestAnimationFrame(this.measure));
    },

    updated() {
        requestAnimationFrame(this.measure);
    },

    beforeUnmount() {
        clearTimeout(this.feedTimer);
        clearTimeout(this.reloadTimer);
        clearInterval(this.countdownTimer);
        clearInterval(this.pageTimer);
        clearTimeout(this.pulseTimer);
        clearTimeout(this.refitTimer);
        window.removeEventListener("resize", this.fit);
        window.removeEventListener("orientationchange", this.fit);
        document.body.classList.remove("tv-panel-body");
    },

    methods: {
        /**
         * Read the panel feed. A failed read keeps the last known frame on screen: a wall panel
         * that blanks out on a hiccup is worse than one showing a slightly stale picture.
         * @returns {void}
         */
        fetchData() {
            axios
                .get(`/api/status-page/${this.slug}/tv`)
                .then((res) => {
                    this.title = res.data.title;
                    this.detectChange(res.data.monitors);
                    this.monitors = res.data.monitors;
                    this.loaded = true;
                    this.leituraFalhou = false;
                    this.lastUpdate = dayjs();
                    this.aplicarIntervaloDeRecarga(res.data.refreshInterval);
                })
                .catch(() => {
                    // Keep the previous frame and try again on the next cycle. The interval stays
                    // as it was: a failed read says nothing about how often to read.
                    //
                    // What must NOT stay as it was is the panel's claim about the situation: with
                    // nothing read, "all normal" is a lie — the exact lie this panel exists to
                    // prevent. It became reachable by a timer when the screen started reloading
                    // itself, instead of only when a person reloaded it.
                    this.leituraFalhou = true;
                })
                .then(() => {
                    this.countdown = SITUATION_SECONDS;
                    this.agendarProximaLeitura();
                });
        },

        /**
         * Adopt the reload interval the status page publishes, with a floor.
         * @param {number} segundos Interval declared in the payload.
         * @returns {void}
         */
        aplicarIntervaloDeRecarga(segundos) {
            const proposto = Number(segundos);
            const novo =
                Number.isFinite(proposto) && proposto > 0
                    ? Math.max(RELOAD_SECONDS_MIN, Math.round(proposto))
                    : RELOAD_SECONDS_DEFAULT;

            // Reagendar a cada leitura adiaria o recarregamento para sempre — a leitura acontece a
            // cada 30 s. Só mexe no timer quando o valor muda, ou quando ainda não há timer.
            if (novo !== this.reloadSeconds || !this.reloadTimer) {
                this.reloadSeconds = novo;
                this.agendarRecarregamento();
            }
        },

        /**
         * Schedule the full screen reload.
         * @returns {void}
         */
        agendarRecarregamento() {
            clearTimeout(this.reloadTimer);
            this.reloadTimer = setTimeout(this.recarregarTela, this.reloadSeconds * 1000);
        },

        /**
         * Reload the page, unless a change is being announced right now.
         * @returns {void}
         */
        recarregarTela() {
            // Um recarregamento no meio do pulso engoliria o anúncio: a página volta sem memória do
            // ciclo anterior, e a mudança que estava piscando some sem ter sido vista.
            if (this.pulsing) {
                this.reloadTimer = setTimeout(this.recarregarTela, PULSE_MS);
                return;
            }

            window.location.reload();
        },

        /**
         * Schedule the next read. A chain of timeouts, not a fixed interval: the administrator can
         * change the setting while the panel is on the wall, and the next read has to obey the new
         * value without anyone touching the TV.
         * @returns {void}
         */
        agendarProximaLeitura() {
            clearTimeout(this.feedTimer);

            this.feedTimer = setTimeout(() => {
                // Refit on every read: this panel stays on a wall for weeks, and a TV that changes
                // resolution without firing `resize` would otherwise stay wrong until someone
                // reloads.
                this.fit();
                this.fetchData();
            }, SITUATION_SECONDS * 1000);
        },

        /**
         * Compare the set of down monitors with the previous read and start the pulse when it moved.
         * Only the monitors that just entered the set are marked, so "went down now" stays visually
         * distinct from "has been down for an hour".
         * @param {object[]} incoming Monitors from the current read.
         * @returns {void}
         */
        detectChange(incoming) {
            const downIds = incoming.filter((monitor) => monitor.status === DOWN).map((monitor) => monitor.id);
            const key = downIds.join(",");

            if (this.previousDownKey !== undefined && this.previousDownKey !== key) {
                const before = this.previousDownKey ? this.previousDownKey.split(",").filter(Boolean) : [];
                this.changedIds = downIds.filter((id) => !before.includes(String(id)));
                this.pulsing = true;

                clearTimeout(this.pulseTimer);
                this.pulseTimer = setTimeout(() => {
                    this.pulsing = false;
                    this.changedIds = [];
                }, PULSE_MS);
            }

            this.previousDownKey = key;
        },

        /**
         * Measure how many rows fit in the list grid. Derived from a real rendered row, never a
         * constant: the space left for the list depends on how tall the highlight block grew.
         * @returns {void}
         */
        measure() {
            const grid = this.$refs.grid;

            if (!grid || !grid.firstElementChild) {
                return;
            }

            // offsetHeight, not getBoundingClientRect(): the frame is scaled by a transform, so
            // the rect comes back in visual pixels while grid.clientHeight is in layout pixels.
            // Dividing one by the other counted 1/scale times more rows than fit, and the surplus
            // spilled past the bottom edge of the canvas, hidden by overflow.
            const rowHeight = grid.firstElementChild.offsetHeight;

            if (!rowHeight) {
                return;
            }

            const rows = Math.max(1, Math.floor(grid.clientHeight / rowHeight));

            // Guard against an update loop: only write when the measurement actually moved.
            if (rows !== this.rows) {
                this.rows = rows;
            }
        },

        /**
         * Fit the fixed canvas into the current window, and centre it.
         *
         * The centring is arithmetic instead of CSS alignment on purpose — see the note on
         * .tv-stage. `document.documentElement.clientWidth` is read first because it is the layout
         * viewport: it ignores the overflow this canvas produces, which `window.innerWidth` does
         * not on every engine.
         * @returns {void}
         */
        fit() {
            const root = document.documentElement;
            const width = root.clientWidth || window.innerWidth;
            const height = root.clientHeight || window.innerHeight;

            // A viewport of zero is a browser that has not laid the page out yet. Keeping the last
            // known fit beats scaling the panel to nothing.
            if (!width || !height) {
                return;
            }

            this.scale = Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
            this.offsetX = Math.round((width - CANVAS_WIDTH * this.scale) / 2);
            this.offsetY = Math.round((height - CANVAS_HEIGHT * this.scale) / 2);
        },

        /**
         * Did this monitor enter the down set in the last change?
         * @param {object} monitor Monitor to check.
         * @returns {boolean} True while it should pulse and carry the badge.
         */
        isJustChanged(monitor) {
            return this.pulsing && this.changedIds.includes(monitor.id);
        },

        /**
         * Beats padded at the front so the bar count is stable even with a short history.
         * @param {object} monitor Monitor whose beats to render.
         * @param {number} length How many bars to draw.
         * @returns {(object|null)[]} Beats, oldest first, with nulls where there is no data.
         */
        paddedBeats(monitor, length) {
            const beats = (monitor.beats || []).slice(-length);
            const padding = new Array(Math.max(0, length - beats.length)).fill(null);
            return padding.concat(beats);
        },

        /**
         * CSS class for one history bar.
         * @param {object|null} beat The beat, or null when there is no data.
         * @returns {string} Class name.
         */
        beatClass(beat) {
            if (!beat) {
                return "tv-bar--empty";
            }
            if (beat.status === DOWN) {
                return "tv-bar--down";
            }
            if (beat.status === PENDING) {
                return "tv-bar--pending";
            }
            if (beat.status === MAINTENANCE) {
                return "tv-bar--maintenance";
            }
            return "tv-bar--up";
        },

        /**
         * How far back the drawn history reaches, derived from the beats themselves.
         * A heartbeat is written on each monitor's own interval, so a fixed bar count is not a
         * fixed duration and the label cannot be hardcoded.
         * @param {object} monitor Monitor whose window to describe.
         * @returns {string} Humanised window, empty when there is nothing to measure.
         */
        historyWindow(monitor) {
            const beats = this.paddedBeats(monitor, HISTORY_LENGTH).filter(Boolean);

            if (beats.length === 0) {
                return "";
            }

            const minutes = dayjs().diff(dayjs.utc(beats[0].time), "minute");

            if (minutes < 1) {
                return this.$t("tvPanelWindowNow");
            }
            if (minutes < 60) {
                return this.$t("tvPanelWindowMinutes", [minutes]);
            }
            return this.$t("tvPanelWindowHours", [Math.floor(minutes / 60)]);
        },

        /**
         * Label of a monitor status.
         * @param {number} status Heartbeat status.
         * @returns {string} Localised label.
         */
        statusLabel(status) {
            if (status === DOWN) {
                return this.$t("tvPanelStatusDown");
            }
            if (status === PENDING) {
                return this.$t("tvPanelStatusDegraded");
            }
            if (status === MAINTENANCE) {
                return this.$t("tvPanelStatusMaintenance");
            }
            if (status === UP) {
                return this.$t("tvPanelStatusNormal");
            }
            return this.$t("tvPanelStatusUnknown");
        },

        /**
         * Sort weight of a status for the mass-outage list: the more broken, the earlier.
         * @param {number|null} status Heartbeat status, or null when the monitor has no beats.
         * @returns {number} Rank, lower first.
         */
        statusRank(status) {
            if (status === DOWN) {
                return 0;
            }
            if (status === PENDING) {
                return 1;
            }
            if (status === MAINTENANCE) {
                return 2;
            }
            if (status === UP) {
                return 3;
            }
            return 4;
        },

        /**
         * CSS class of a list row, by status.
         * @param {object} monitor Monitor of the row.
         * @returns {string} Class name.
         */
        rowClass(monitor) {
            if (monitor.status === DOWN) {
                return "tv-row--down";
            }
            if (monitor.status === PENDING) {
                return "tv-row--pending";
            }
            if (monitor.status === MAINTENANCE) {
                return "tv-row--maintenance";
            }
            return "tv-row--up";
        },
    },
};
</script>

<!-- The @font-face rules stay out of the scoped block: at-rules are not scoped, and keeping them
     apart makes it explicit that the only thing this component adds globally is the font family. -->
<!-- eslint-disable-next-line vue-scoped-css/enforce-style-type -->
<style>
@import "../assets/fonts/plus-jakarta-sans.css";

/* Not scoped: the panel takes over the whole screen, and a body margin or a stray scroll shifts a
   fixed layer on the older engines this runs on. Applied only while the panel is mounted. */
body.tv-panel-body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
}
</style>

<style lang="scss" scoped>
.tv-stage {
    /* Tokens of the Winker Design System V2, as specified in the design handoff.
       --color-* are the brand/semantic tokens; the neutrals are fixed in the V2 theme. */
    --tv-primary: #b11655;
    --tv-success: forestgreen;
    --tv-warning: orange;
    --tv-danger: #f53d3d;
    --tv-info: #0288d1;
    --tv-text-strong: #3d3d3d;
    --tv-text-secondary: #656565;
    --tv-surface: #ffffff;
    --tv-border: #dcdcdc;
    --tv-divider: #eef0f3;
    --tv-canvas: #f4f5f7;
    --tv-r-card: 16px;
    --tv-r-badge: 99px;
    --tv-shadow-card: 0 4px 12px rgba(0, 0, 0, 0.08);
    --tv-shadow-alert:
        0 20px 25px -5px rgba(0, 0, 0, 0.1),
        0 8px 10px -6px rgba(0, 0, 0, 0.1);
    --tv-font: "Plus Jakarta Sans", -apple-system, blinkmacsystemfont, "Segoe UI", roboto, system-ui, sans-serif;
    --tv-empty: #e6e8eb;

    /* Explicit offsets, and an explicit translate in fit(), on purpose: the panel landed off the
       bottom-right corner on the built-in browser of a TCL TV set. Reproduced by emulating an
       engine that ignores `inset` (it is Chromium 87+, newer than a TV browser is likely to be):
       the stage then never anchors to the viewport, and grid centring is a no-op here anyway,
       because the track is sized by the 1920x1080 frame itself. Either failure leaves the frame's
       centre at (960, 540) of a viewport half that size, which is where the TV put it. Nothing
       below is newer than CSS transforms, which that browser demonstrably runs. */
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
}

.tv-frame {
    position: absolute;
    top: 0;
    left: 0;
    width: 1920px;
    height: 1080px;
    box-sizing: border-box;
    transform-origin: 0 0;
    background: var(--tv-canvas);
    color: var(--tv-text-strong);
    font-family: var(--tv-font);
    padding: 40px 64px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    overflow: hidden;

    * {
        box-sizing: border-box;
    }

    p,
    h1,
    h2,
    h3 {
        margin: 0;
    }
}

/* ---- Cabeçalho ---- */
.tv-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 40px;

    &__identity {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    &__clock {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        font-size: 24px;
        color: var(--tv-text-secondary);
    }

    /* Aplicado no <p>, então ganha do color herdado do bloco acima, em qualquer ordem. */
    &__stale {
        color: var(--tv-warning);
        font-weight: 700;
    }
}

.tv-eyebrow {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--tv-primary);
}

.tv-title {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
}

/* ---- Bloco de destaque ---- */
.tv-alert {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    border-radius: var(--tv-r-card);
    overflow: hidden;

    /* O bloco inteiro é vermelho, e não só a faixa: com o corpo branco, de longe o destaque
       era uma tarja em cima de um card igual aos da lista. Tudo que fica por cima dele é branco. */
    background: var(--tv-danger);
    color: #fff;

    /* O halo permanente engorda o bloco mesmo parado: fora do pulso, o destaque disputa
       atenção com uma sala inteira, não com o resto da tela. */
    box-shadow:
        var(--tv-shadow-alert),
        0 0 0 5px rgba(245, 61, 61, 0.18);
    border: 4px solid var(--tv-danger);

    &--pulsing {
        animation: tv-alert-pulse 1s ease-in-out infinite;
    }

    &__band {
        position: relative;
        background: var(--tv-danger);
        color: #fff;
        padding: 40px 36px;
        display: flex;
        align-items: center;
        gap: 20px;

        &--pulsing {
            animation: tv-band-flash 1s ease-in-out infinite;
        }
    }

    &__dot {
        position: relative;
        z-index: 1;
        width: 26px;
        height: 26px;
        border-radius: 99px;
        background: #fff;
        animation: tv-dot-pulse 1.1s ease-in-out infinite;
    }

    &__title {
        position: relative;
        z-index: 1;
        font-size: 34px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;

        /* A onda passa por baixo do texto, e com o traço grosso ela cruza a linha das letras em
           branco quase puro: o que sustenta a leitura ali é o halo escuro colado no glifo, não a
           sombra projetada — texto branco sobre pico branco só se separa por contorno. */
        text-shadow:
            0 0 4px rgba(120, 0, 0, 0.9),
            0 0 14px rgba(120, 0, 0, 0.7),
            0 2px 6px rgba(120, 0, 0, 0.5);
    }

    &__count {
        position: relative;
        z-index: 1;
        margin-left: auto;
        font-size: 30px;
        font-weight: 700;
        text-shadow:
            0 0 4px rgba(120, 0, 0, 0.9),
            0 0 14px rgba(120, 0, 0, 0.7),
            0 2px 6px rgba(120, 0, 0, 0.5);
    }

    &__single {
        padding: 28px 36px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.28);
    }

    &__headline {
        display: flex;
        align-items: center;
        gap: 40px;
        flex-wrap: wrap;

        h2 {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: -0.02em;
            line-height: 1.05;
            color: #fff;
            text-shadow: 0 2px 6px rgba(120, 0, 0, 0.45);
        }
    }

    &__grid {
        padding: 16px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.28);
    }

    /* As barras mantêm a legenda da lista (vermelho = queda, verde = normal): sobre o vermelho
       do bloco a barra de queda sumiria, então cada régua ganha uma bandeja cinza em vez de
       trocar de cor e passar a dizer outra coisa que a lista de baixo. */
    .tv-bars {
        background: #bebebe;
        padding: 8px 10px;
        border-radius: 10px;
    }

    /* Selo "mudou agora" invertido: vermelho sobre vermelho não é selo. */
    .tv-badge {
        background: #fff;
        color: var(--tv-danger);
    }
}

/* ---- Sem leitura do servidor ---- */
.tv-blind {
    flex: 0 0 auto;
    background: var(--tv-surface);
    border-radius: var(--tv-r-card);
    border: 3px solid var(--tv-warning);
    box-shadow: var(--tv-shadow-card);
    padding: 32px 36px;
    display: flex;
    align-items: center;
    gap: 22px;

    &__dot {
        flex: 0 0 auto;
        width: 22px;
        height: 22px;
        border-radius: 99px;
        background: var(--tv-warning);
        animation: tv-dot-pulse 1.1s ease-in-out infinite;
    }

    &__title {
        font-size: 40px;
        font-weight: 800;
    }

    &__hint {
        font-size: 24px;
        color: var(--tv-text-secondary);
    }
}

/* ---- Onda do destaque ----
   Três senóides em velocidades diferentes, como a onda dos assistentes de IA. A translação fica
   nas camadas e a amplitude no pai, para os dois transforms não disputarem o mesmo elemento. */
.tv-wave {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
    opacity: 1;
    transform: scaleY(1);
    transition: transform 0.4s ease-out;

    /* Enquanto a mudança é notícia a onda cresce. Não clareia: fora do pulso ela já está no opaco
       máximo, porque o pulso dura 30 s e a queda dura o que durar — guardar brilho para o pulso
       deixava a onda apagada na maior parte do tempo em que este bloco fica na parede. A amplitude
       fica aqui, no pai, porque a translação de cada camada já ocupa o transform delas. */
    &--pulsing {
        transform: scaleY(1.45);
    }

    &__layer {
        position: absolute;
        top: 0;
        left: 0;

        /* 200% + translateX(-50%) fecha o ciclo sem emenda: o viewBox tem duas ondulações
           inteiras e é esticado sobre o dobro da largura do container, então a translação de meia
           largura própria (= uma tela, = uma ondulação) cai exatamente onde o desenho recomeça. */
        width: 200%;
        height: 100%;
        fill: none;
        stroke: #fff;
        animation: tv-wave-travel 9s linear infinite;
        will-change: transform;
    }

    /* Espessura em PIXEL DE TELA (`vector-effect="non-scaling-stroke"`, no template): o traço não
       acompanha o esticamento do viewBox, então estes números são a grossura que sai no painel de
       1920 — e é por isso que 9 px, que parece razoável num gráfico, desaparece numa parede. */
    &__layer--back {
        opacity: 0.22;
        stroke-width: 30;
        animation-duration: 8.5s;
    }

    &__layer--mid {
        opacity: 0.4;
        stroke-width: 19;
        animation-duration: 6s;
        animation-direction: reverse;
    }

    &__layer--front {
        opacity: 0.8;
        stroke-width: 13;
        animation-duration: 4s;
    }
}

.tv-pill {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 22px;
    border-radius: var(--tv-r-badge);
    background: #fff;

    p {
        font-size: 28px;
        font-weight: 800;
        color: var(--tv-danger);
    }

    &__dot {
        width: 14px;
        height: 14px;
        border-radius: 99px;
        background: var(--tv-danger);
    }
}

.tv-history {
    display: flex;
    flex-direction: column;
    gap: 10px;

    &__label {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.85);
    }

    &__axis {
        display: flex;
        justify-content: space-between;
        font-size: 20px;
        color: rgba(255, 255, 255, 0.85);
    }
}

.tv-card {
    /* Card cinza sobre o vermelho do bloco: o contraste vem do fundo, e o texto volta a ser
       escuro — branco sobre este cinza não se lê a distância. */
    background: #bebebe;
    color: var(--tv-text-strong);
    border: 2px solid rgba(255, 255, 255, 0.45);
    border-radius: var(--tv-r-card);
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    &--pulsing {
        animation: tv-card-pulse 0.9s ease-in-out infinite;
    }

    &__top {
        display: flex;
        align-items: flex-start;
        gap: 12px;

        h3 {
            flex: 1 1 auto;
            min-width: 0;
            font-size: 30px;
            font-weight: 800;
            letter-spacing: -0.01em;
            line-height: 1.15;
        }
    }

    &__error {
        font-size: 22px;
        font-weight: 700;
        color: var(--tv-text-strong);
    }

    .tv-bars {
        margin-top: auto;
    }
}

.tv-badge {
    background: #ff2d2d;
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.06em;
    white-space: nowrap;
    flex: 0 0 auto;
    padding: 6px 14px;
    border-radius: var(--tv-r-badge);
}

/* ---- Tudo normal ---- */
.tv-ok {
    flex: 0 0 auto;
    background: var(--tv-surface);
    border-radius: var(--tv-r-card);
    border: 1px solid var(--tv-divider);
    box-shadow: var(--tv-shadow-card);
    padding: 40px 36px;
    display: flex;
    align-items: center;
    gap: 22px;

    &--pulsing {
        animation: tv-ok-pulse 1s ease-in-out infinite;
    }

    &__dot {
        width: 22px;
        height: 22px;
        border-radius: 99px;
        background: var(--tv-success);
    }

    p {
        font-size: 44px;
        font-weight: 800;
    }
}

/* ---- Lista ---- */
.tv-list {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;

    &__head {
        display: flex;
        align-items: baseline;
        gap: 20px;

        h2 {
            font-size: 34px;
            font-weight: 800;
        }

        p {
            font-size: 24px;
            color: var(--tv-text-secondary);
        }
    }

    &__grid {
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;

        /* The divider colour showing through the 1px column gap is what draws the separators. */
        background: var(--tv-divider);
        border-radius: var(--tv-r-card);
        box-shadow: var(--tv-shadow-card);
        border: 1px solid var(--tv-divider);
        display: grid;

        /* minmax(0, 1fr) is required: with 1fr the rows overflow the container width. */
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 1px;
        align-content: start;
    }
}

.tv-row {
    /* One accent per row state: the marker and the status text always agree, and a new state is
       one variable rather than a pair of overrides that can drift apart. */
    --tv-row-accent: var(--tv-success);

    display: flex;
    align-items: center;
    gap: 20px;
    padding: 14px 28px;
    border-top: 1px solid var(--tv-divider);
    background: var(--tv-surface);

    &__marker {
        width: 8px;
        align-self: stretch;
        border-radius: 99px;
        background: var(--tv-row-accent);
    }

    &__name {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 24px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__cause {
        font-size: 22px;
        font-weight: 600;
        color: var(--tv-row-accent);
    }

    &__status {
        flex: 0 0 auto;
        width: 130px;
        font-size: 20px;
        font-weight: 700;
        color: var(--tv-row-accent);
    }

    &--down {
        --tv-row-accent: var(--tv-danger);

        background: rgba(245, 61, 61, 0.07);
    }

    &--pending {
        --tv-row-accent: var(--tv-warning);

        background: rgba(255, 165, 0, 0.1);
    }

    &--maintenance {
        --tv-row-accent: var(--tv-info);

        background: rgba(2, 136, 209, 0.08);
    }
}

/* ---- Barras de histórico ---- */
.tv-bars {
    display: flex;
    align-items: flex-end;
    flex: 0 0 auto;

    &--lg {
        gap: 6px;

        .tv-bar {
            width: 24px;
            height: 52px;
            border-radius: 4px;
        }
    }

    &--sm {
        gap: 3px;

        .tv-bar {
            width: 8px;
            height: 34px;
            border-radius: 2px;
        }
    }

    &--xs {
        gap: 2px;

        .tv-bar {
            width: 6px;
            height: 26px;
            border-radius: 2px;
        }
    }
}

.tv-bar {
    background: var(--tv-empty);

    &--up {
        background: var(--tv-success);
    }

    &--pending {
        background: var(--tv-warning);
    }

    &--down {
        background: var(--tv-danger);
    }

    &--maintenance {
        background: var(--tv-info);
    }

    &--empty {
        background: var(--tv-empty);
    }
}

/* ---- Animações ---- */
@keyframes tv-dot-pulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
    }

    50% {
        opacity: 0.35;
        transform: scale(0.62);
        box-shadow: 0 0 0 16px rgba(255, 255, 255, 0);
    }
}

@keyframes tv-alert-pulse {
    0%,
    100% {
        box-shadow:
            var(--tv-shadow-alert),
            0 0 0 0 rgba(245, 61, 61, 0.85);
        border-color: #ff2d2d;
    }

    50% {
        box-shadow:
            var(--tv-shadow-alert),
            0 0 0 32px rgba(245, 61, 61, 0);
        border-color: var(--tv-danger);
    }
}

/* A faixa bate entre o vermelho da marca de erro e um mais fundo. Fundo, e não mais claro: no
   claro o texto branco de cima perde contraste justo no instante que devia chamar mais. */
@keyframes tv-band-flash {
    0%,
    100% {
        background: var(--tv-danger);
    }

    50% {
        background: #b81414;
    }
}

@keyframes tv-wave-travel {
    from {
        transform: translateX(0);
    }

    to {
        transform: translateX(-50%);
    }
}

/* O card é cinza sobre o vermelho do bloco: o fundo não bate, quem bate é a borda e o anel,
   em branco, que é o que contrasta ali. */
@keyframes tv-card-pulse {
    0%,
    100% {
        border-color: #fff;
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.75);
    }

    50% {
        border-color: rgba(255, 255, 255, 0.45);
        box-shadow: 0 0 0 20px rgba(255, 255, 255, 0);
    }
}

@keyframes tv-ok-pulse {
    0%,
    100% {
        box-shadow:
            var(--tv-shadow-card),
            0 0 0 0 rgba(34, 197, 94, 0.5);
    }

    50% {
        box-shadow:
            var(--tv-shadow-card),
            0 0 0 16px rgba(34, 197, 94, 0);
    }
}
</style>
