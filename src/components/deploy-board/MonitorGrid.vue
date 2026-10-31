<template>
    <div ref="area" class="db-grid-area" :class="{ 'is-fill': fill }">
        <!-- Natural height of one cell, measured instead of assumed: the capacity follows the font. -->
        <div ref="probe" class="db-cell db-cell-probe" aria-hidden="true">
            <span class="db-cell-name">Monitor</span>
            <span class="db-cell-row">
                <span class="db-cell-state">Normal</span>
                <span class="db-beats"><i v-for="n in beatCount" :key="n"></i></span>
            </span>
        </div>

        <div class="db-grid" :style="gridStyle">
            <div v-for="monitor in visibleMonitors" :key="monitor.id" class="db-cell" :class="'is-' + monitor.tone">
                <span class="db-cell-name">{{ monitor.name }}</span>
                <span class="db-cell-row">
                    <span class="db-cell-state">{{ monitor.label }}</span>
                    <span class="db-beats" aria-hidden="true">
                        <i v-for="(beat, i) in monitor.beats" :key="i" :class="'b-' + beat"></i>
                    </span>
                </span>
            </div>
        </div>
    </div>
</template>

<script>
/** How often the grid turns to the next page when the monitors do not fit. */
const PAGE_MS = 15000;

/** Narrowest cell, in em of the board font: below this the name and the bars collide. */
const MIN_CELL_EM = 14;

/** A cell never grows past this many times its natural height, so few monitors do not balloon. */
const MAX_STRETCH = 1.7;

/** Heartbeat bars drawn per cell. */
const BEATS = 24;

/** Re-measures allowed after a layout change made a cell taller than its row. */
const MAX_PASSES = 3;

/**
 * Height a cell needs for its content, whatever row height it was given. `scrollHeight` would not
 * do: it never drops below the stretched height, so it would only ever grow.
 * @param {HTMLElement} cell A grid cell (or the probe).
 * @returns {number} Pixels.
 */
function contentHeight(cell) {
    const style = getComputedStyle(cell);
    let total =
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth);
    const children = [...cell.children];
    for (const child of children) {
        total += child.offsetHeight;
    }
    total += (parseFloat(style.rowGap) || 0) * Math.max(0, children.length - 1);
    return Math.ceil(total);
}

export default {
    props: {
        /** Monitors to draw: { id, name, label, tone, beats } */
        monitors: {
            type: Array,
            required: true,
        },
        /** True when the board is a one-screen wall layout; false when it stacks and scrolls. */
        fill: {
            type: Boolean,
            default: true,
        },
    },

    emits: ["paging"],

    data() {
        return {
            beatCount: BEATS,
            cols: 0,
            rowHeight: 0,
            perPage: Infinity,
            page: 0,
        };
    },

    computed: {
        /** @returns {number} Number of pages */
        pageCount() {
            if (!Number.isFinite(this.perPage)) {
                return 1;
            }
            return Math.max(1, Math.ceil(this.monitors.length / this.perPage));
        },

        /** @returns {object[]} Monitors on the current page */
        visibleMonitors() {
            if (this.pageCount === 1) {
                return this.monitors;
            }
            const index = this.page % this.pageCount;
            return this.monitors.slice(index * this.perPage, (index + 1) * this.perPage);
        },

        /** @returns {object} Inline grid geometry, only in the wall layout */
        gridStyle() {
            if (!this.fill || !this.cols) {
                return {};
            }
            return {
                gridTemplateColumns: `repeat(${this.cols}, minmax(0, 1fr))`,
                gridAutoRows: `${this.rowHeight}px`,
            };
        },
    },

    watch: {
        "monitors.length"() {
            this.$nextTick(this.measure);
        },
        fill() {
            this.$nextTick(this.measure);
        },
        pageCount: {
            handler(count) {
                this.$emit("paging", { page: (this.page % count) + 1, pages: count });
                this.schedulePaging();
            },
            immediate: true,
        },
        page() {
            this.$emit("paging", { page: (this.page % this.pageCount) + 1, pages: this.pageCount });
        },
    },

    mounted() {
        this.observer = new ResizeObserver(() => this.measure());
        this.observer.observe(this.$refs.area);
        this.measure();
    },

    beforeUnmount() {
        this.observer?.disconnect();
        clearInterval(this.pageTimer);
    },

    methods: {
        /**
         * Pick the fewest columns in which every monitor fits at its natural height; when even the
         * widest arrangement does not fit, keep that arrangement and page through it.
         * @param {number} pass Re-measure count within one layout change, starting at 0.
         * @returns {void}
         */
        measure(pass = 0) {
            if (!this.fill) {
                this.cols = 0;
                this.perPage = Infinity;
                return;
            }

            const area = this.$refs.area;
            const probe = this.$refs.probe;
            if (!area || !probe) {
                return;
            }

            const width = area.clientWidth;
            const height = area.clientHeight;
            // The probe has a one-line name; a long name that wraps makes its cell taller. Taking
            // the tallest drawn cell as the floor keeps a fixed row height from clipping it.
            const natural = Math.max(contentHeight(probe), this.tallestCell());
            const fontSize = parseFloat(getComputedStyle(area).fontSize) || 16;
            const gap = parseFloat(getComputedStyle(area).getPropertyValue("--db-gap")) || 8;
            if (!width || !height || !natural) {
                return;
            }

            const n = Math.max(1, this.monitors.length);
            const minWidth = MIN_CELL_EM * fontSize;
            const maxCols = Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
            const rowsThatFit = Math.max(1, Math.floor((height + gap) / (natural + gap)));

            let cols = 0;
            for (let c = 1; c <= maxCols; c++) {
                if (Math.ceil(n / c) <= rowsThatFit) {
                    cols = c;
                    break;
                }
            }

            let perPage = Infinity;
            if (!cols) {
                cols = maxCols;
                perPage = cols * rowsThatFit;
            }

            const rows = Math.ceil(Math.min(n, perPage) / cols);
            const stretched = (height - gap * (rows - 1)) / rows;

            this.cols = cols;
            this.perPage = perPage;
            this.rowHeight = Math.floor(Math.max(natural, Math.min(stretched, natural * MAX_STRETCH)));

            // The new column width changes how names wrap: check the drawn cells once more and,
            // if one no longer fits its row, measure again. The pass limit keeps it from looping.
            this.$nextTick(() => {
                if (pass < MAX_PASSES && this.tallestCell() > this.rowHeight + 1) {
                    this.measure(pass + 1);
                }
            });
        },

        /**
         * Content height of the tallest cell on screen (0 when none is drawn).
         * @returns {number} Pixels.
         */
        tallestCell() {
            const grid = this.$refs.area?.querySelector(".db-grid");
            if (!grid) {
                return 0;
            }
            let tallest = 0;
            for (const cell of grid.children) {
                tallest = Math.max(tallest, contentHeight(cell));
            }
            return tallest;
        },

        /**
         * Turn pages only while there is more than one.
         * @returns {void}
         */
        schedulePaging() {
            clearInterval(this.pageTimer);
            this.pageTimer = null;
            if (this.pageCount > 1) {
                this.pageTimer = setInterval(() => {
                    this.page = (this.page + 1) % this.pageCount;
                }, PAGE_MS);
            } else {
                this.page = 0;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.db-grid-area {
    position: relative;

    // Only the wall layout has a fixed height to share out; stacked, the grid takes what it needs.
    &.is-fill {
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
    }
}

.db-grid {
    display: grid;
    gap: var(--db-gap);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 14em), 1fr));
    align-content: start;
}

.db-cell {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.35em;
    min-width: 0;
    overflow: hidden;
    padding: 0.5em 0.8em;
    background: var(--db-panel);
    border: 1px solid var(--db-line);
    border-radius: 8px;
}

.db-cell-probe {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    width: 14em;
    left: 0;
    top: 0;
}

.db-cell-name {
    font-size: 1.05em;
    font-weight: 600;
    line-height: 1.2;
    overflow-wrap: anywhere;
}

.db-cell-row {
    display: flex;
    align-items: center;
    gap: 0.6em;
    min-width: 0;
}

.db-cell-state {
    font-size: 0.82em;
    font-weight: 700;
    white-space: nowrap;
    color: var(--db-ok);
}

.db-beats {
    display: flex;
    justify-content: flex-end;
    gap: 2px;
    flex: 1;
    min-width: 0;
    height: 0.9em;

    i {
        flex: 0 1 5px;
        min-width: 2px;
        border-radius: 2px;
        background: var(--db-panel-2);
    }

    .b-up {
        background: var(--db-ok);
    }

    .b-pending {
        background: var(--db-warn);
    }

    .b-down {
        background: var(--db-bad);
    }

    .b-maintenance {
        background: var(--db-maint);
    }
}

.is-maintenance {
    background: var(--db-maint-soft);

    .db-cell-state {
        color: var(--db-maint);
    }
}

.is-paused,
.is-unknown {
    .db-cell-state {
        color: var(--db-ink-3);
    }
}
</style>
