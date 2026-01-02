<template>
    <div ref="wrap" class="wrap" :style="wrapStyle">
        <div class="hp-bar-big" :style="barStyle">
            <canvas
                ref="canvas"
                class="heartbeat-canvas"
                :width="canvasWidth"
                :height="canvasHeight"
                :aria-label="canvasAriaLabel"
                role="img"
                tabindex="0"
                @mousemove="handleMouseMove"
                @mouseleave="hideTooltip"
                @click="handleClick"
                @keydown="handleKeydown"
                @focus="handleFocus"
                @blur="handleBlur"
            />
        </div>
        <div
            v-if="!$root.isMobile && size !== 'small' && beatList.length > 4 && $root.styleElapsedTime !== 'none'"
            class="d-flex justify-content-between align-items-center word" :style="timeStyle"
        >
            <div>{{ timeSinceFirstBeat }}</div>
            <div v-if="$root.styleElapsedTime === 'with-line'" class="connecting-line"></div>
            <div>{{ timeSinceLastBeat }}</div>
        </div>

        <!-- Custom Tooltip -->
        <Tooltip
            :visible="tooltipVisible"
            :content="tooltipContent"
            :x="tooltipX"
            :y="tooltipY"
            :position="tooltipPosition"
        />
    </div>
</template>

<script>
import dayjs from "dayjs";
import { DOWN, UP, PENDING, MAINTENANCE } from "../util.ts";
import Tooltip from "./Tooltip.vue";

export default {
    components: {
        Tooltip,
    },
    props: {
        /** Size of the heartbeat bar */
        size: {
            type: String,
            default: "big",
        },
        /** ID of the monitor */
        monitorId: {
            type: Number,
            required: true,
        },
        /** Array of the monitors heartbeats */
        heartbeatList: {
            type: Array,
            default: null,
        },
        /** Heartbeat bar days */
        heartbeatBarDays: {
            type: Number,
            default: 0
        }
    },
    data() {
        return {
            beatWidth: 10,
            beatHeight: 30,
            hoverScale: 1.5,
            beatHoverAreaPadding: 4,
            move: false,
            maxBeat: -1,
            // Tooltip data
            tooltipVisible: false,
            tooltipContent: null,
            tooltipX: 0,
            tooltipY: 0,
            tooltipPosition: "below",
            tooltipTimeoutId: null,
            // Canvas
            hoveredBeatIndex: -1,
        };
    },
    computed: {

        /**
         * Normalized heartbeatBarDays as a number
         * @returns {number} Number of days for heartbeat bar
         */
        normalizedHeartbeatBarDays() {
            return Math.max(0, Math.min(365, Math.floor(this.heartbeatBarDays || 0)));
        },

        /**
         * If heartbeatList is null, get it from $root.heartbeatList
         * @returns {object} Heartbeat list
         */
        beatList() {
            if (this.heartbeatList === null) {
                return this.$root.heartbeatList[this.monitorId];
            } else {
                return this.heartbeatList;
            }
        },

        /**
         * Calculates the amount of beats of padding needed to fill the length of shortBeatList.
         * @returns {number} The amount of beats of padding needed to fill the length of shortBeatList.
         */
        numPadding() {
            if (!this.beatList) {
                return 0;
            }

            // For configured ranges, no padding needed since we show all beats
            if (this.normalizedHeartbeatBarDays > 0) {
                return 0;
            }

            let num = this.beatList.length - this.maxBeat;

            if (this.move) {
                num = num - 1;
            }

            if (num > 0) {
                return 0;
            }

            return -1 * num;
        },

        shortBeatList() {
            if (!this.beatList) {
                return [];
            }

            // If heartbeat days is configured (not auto), data is already aggregated from server
            if (this.normalizedHeartbeatBarDays > 0 && this.beatList.length > 0) {
                // Show all beats from server - they are already properly aggregated
                return this.beatList;
            }

            // Original logic for auto mode (heartbeatBarDays = 0)
            let placeholders = [];

            // Handle case where maxBeat is -1 (no limit)
            if (this.maxBeat <= 0) {
                return this.beatList;
            }

            let start = this.beatList.length - this.maxBeat;

            if (this.move) {
                start = start - 1;
            }

            if (start < 0) {
                // Add empty placeholder
                for (let i = start; i < 0; i++) {
                    placeholders.push(0);
                }
                start = 0;
            }

            return placeholders.concat(this.beatList.slice(start));
        },

        wrapStyle() {
            let topBottom = (((this.beatHeight * this.hoverScale) - this.beatHeight) / 2);
            let leftRight = (((this.beatWidth * this.hoverScale) - this.beatWidth) / 2);

            return {
                padding: `${topBottom}px ${leftRight}px`,
                width: "100%",
            };
        },

        barStyle() {
            if (this.move && this.shortBeatList.length > this.maxBeat) {
                let width = -(this.beatWidth + this.beatHoverAreaPadding * 2);

                return {
                    transition: "all ease-in-out 0.25s",
                    transform: `translateX(${width}px)`,
                };

            }
            return {
                transform: "translateX(0)",
            };

        },

        beatHoverAreaStyle() {
            return {
                padding: this.beatHoverAreaPadding + "px",
                "--hover-scale": this.hoverScale,
            };
        },

        beatStyle() {
            return {
                width: this.beatWidth + "px",
                height: this.beatHeight + "px",
            };
        },

        /**
         * Returns the style object for positioning the time element.
         * @returns {object} The style object containing the CSS properties for positioning the time element.
         */
        timeStyle() {
            return {
                "margin-left": this.numPadding * (this.beatWidth + this.beatHoverAreaPadding * 2) + "px",
            };
        },

        /**
         * Calculates the time elapsed since the first valid beat.
         * @returns {string} The time elapsed in minutes or hours.
         */
        timeSinceFirstBeat() {
            if (this.normalizedHeartbeatBarDays === 1) {
                return (this.normalizedHeartbeatBarDays * 24) + "h";
            }
            if (this.normalizedHeartbeatBarDays >= 2) {
                return this.normalizedHeartbeatBarDays + "d";
            }

            // Need to calculate from actual data
            const firstValidBeat = this.shortBeatList.at(this.numPadding);
            const minutes = dayjs().diff(dayjs.utc(firstValidBeat?.time), "minutes");
            return minutes > 60 ? Math.floor(minutes / 60) + "h" : minutes + "m";
        },

        /**
         * Calculates the elapsed time since the last valid beat was registered.
         * @returns {string} The elapsed time in a minutes, hours or "now".
         */
        timeSinceLastBeat() {
            const lastValidBeat = this.shortBeatList.at(-1);
            const seconds = dayjs().diff(dayjs.utc(lastValidBeat?.time), "seconds");

            let tolerance = 60 * 2; // default for when monitorList not available
            if (this.$root.monitorList[this.monitorId] != null) {
                tolerance = this.$root.monitorList[this.monitorId].interval * 2;
            }

            if (seconds < tolerance) {
                return this.$t("now");
            } else if (seconds < 60 * 60) {
                return this.$t("time ago", [ (seconds / 60).toFixed(0) + "m" ] );
            } else {
                return this.$t("time ago", [ (seconds / 60 / 60).toFixed(0) + "h" ] );
            }
        },

        /**
         * Canvas width based on number of beats
         * @returns {number} Canvas width in pixels
         */
        canvasWidth() {
            const beatFullWidth = this.beatWidth + (this.beatHoverAreaPadding * 2);
            return this.shortBeatList.length * beatFullWidth;
        },

        /**
         * Canvas height based on beat height and hover scale
         * @returns {number} Canvas height in pixels
         */
        canvasHeight() {
            return this.beatHeight * this.hoverScale;
        },

        /**
         * Aria label for canvas accessibility
         * @returns {string} Description of heartbeat status
         */
        canvasAriaLabel() {
            if (!this.shortBeatList || this.shortBeatList.length === 0) {
                return "Heartbeat history: No data";
            }

            const validBeats = this.shortBeatList.filter(b => b !== 0 && b !== null);
            const upCount = validBeats.filter(b => Number(b.status) === UP).length;
            const downCount = validBeats.filter(b => Number(b.status) === DOWN).length;

            return `Heartbeat history: ${validBeats.length} checks, ${upCount} up, ${downCount} down`;
        },
    },
    watch: {
        beatList: {
            handler() {
                // Only handle the slide animation, drawCanvas is triggered by shortBeatList watcher
                this.move = true;

                setTimeout(() => {
                    this.move = false;
                }, 300);
            },
            deep: true,
        },

        shortBeatList() {
            // Triggers on beatList, maxBeat, or move changes
            this.$nextTick(() => {
                this.drawCanvas();
            });
        },

        "$root.theme"() {
            // Redraw canvas when theme changes (nextTick ensures .dark class is applied)
            this.$nextTick(() => {
                this.drawCanvas();
            });
        },

        hoveredBeatIndex() {
            this.drawCanvas();
        },
    },
    unmounted() {
        window.removeEventListener("resize", this.resize);
        // Clean up tooltip timeout
        if (this.tooltipTimeoutId) {
            clearTimeout(this.tooltipTimeoutId);
        }
    },
    beforeMount() {
        if (this.heartbeatList === null) {
            if (!(this.monitorId in this.$root.heartbeatList)) {
                this.$root.heartbeatList[this.monitorId] = [];
            }
        }
    },

    mounted() {
        if (this.size !== "big") {
            this.beatWidth = 5;
            this.beatHeight = 16;
            this.beatHoverAreaPadding = 2;
        }

        // Suddenly, have an idea how to handle it universally.
        // If the pixel * ratio != Integer, then it causes render issue, round it to solve it!!
        const actualWidth = this.beatWidth * window.devicePixelRatio;
        const actualHoverAreaPadding = this.beatHoverAreaPadding * window.devicePixelRatio;

        if (!Number.isInteger(actualWidth)) {
            this.beatWidth = Math.round(actualWidth) / window.devicePixelRatio;
        }

        if (!Number.isInteger(actualHoverAreaPadding)) {
            this.beatHoverAreaPadding = Math.round(actualHoverAreaPadding) / window.devicePixelRatio;
        }

        window.addEventListener("resize", this.resize);
        this.resize();

        // Initial canvas draw
        this.$nextTick(() => {
            this.drawCanvas();
        });
    },
    methods: {
        /**
         * Resize the heartbeat bar
         * @returns {void}
         */
        resize() {
            if (this.$refs.wrap) {
                const newMaxBeat = Math.floor(this.$refs.wrap.clientWidth / (this.beatWidth + this.beatHoverAreaPadding * 2));

                // If maxBeat changed and we're in configured days mode, notify parent to reload data
                if (newMaxBeat !== this.maxBeat && this.normalizedHeartbeatBarDays > 0) {
                    this.maxBeat = newMaxBeat;

                    // Find the closest parent with reloadHeartbeatData method (StatusPage)
                    let parent = this.$parent;
                    while (parent && !parent.reloadHeartbeatData) {
                        parent = parent.$parent;
                    }
                    if (parent && parent.reloadHeartbeatData) {
                        parent.reloadHeartbeatData(newMaxBeat);
                    }
                } else {
                    this.maxBeat = newMaxBeat;
                }
            }
        },

        /**
         * Get the title of the beat.
         * Used as the hover tooltip on the heartbeat bar.
         * @param {object} beat Beat to get title from
         * @returns {string} Beat title
         */
        getBeatTitle(beat) {
            if (!beat) {
                return "";
            }

            // Show timestamp for all beats (both individual and aggregated)
            return `${this.$root.datetime(beat.time)}${beat.msg ? ` - ${beat.msg}` : ""}`;
        },

        /**
         * Get CSS classes for a beat element based on its status
         * @param {object} beat - Beat object containing status information
         * @returns {object} Object with CSS class names as keys and boolean values
         */
        getBeatClasses(beat) {
            if (beat === 0 || beat === null || beat?.status === null) {
                return { empty: true };
            }

            const status = Number(beat.status);

            return {
                down: status === DOWN,
                pending: status === PENDING,
                maintenance: status === MAINTENANCE
            };
        },

        /**
         * Get the aria-label for accessibility
         * @param {object} beat Beat to get aria-label from
         * @returns {string} Aria label
         */
        getBeatAriaLabel(beat) {
            switch (beat?.status) {
                case DOWN:
                    return `Down at ${this.$root.datetime(beat.time)}`;
                case UP:
                    return `Up at ${this.$root.datetime(beat.time)}`;
                case PENDING:
                    return `Pending at ${this.$root.datetime(beat.time)}`;
                case MAINTENANCE:
                    return `Maintenance at ${this.$root.datetime(beat.time)}`;
                default:
                    return "No data";
            }
        },

        /**
         * Show custom tooltip
         * @param {object} beat Beat data
         * @param {number} beatIndex Index of the beat
         * @param {object} canvasRect Canvas bounding rectangle
         * @returns {void}
         */
        showTooltip(beat, beatIndex, canvasRect) {
            if (beat === 0 || !beat) {
                this.hideTooltip();
                return;
            }

            // Clear any existing timeout
            if (this.tooltipTimeoutId) {
                clearTimeout(this.tooltipTimeoutId);
            }

            // Small delay for better UX
            this.tooltipTimeoutId = setTimeout(() => {
                this.tooltipContent = beat;

                // Calculate the beat's position within the canvas
                const beatFullWidth = this.beatWidth + (this.beatHoverAreaPadding * 2);
                const beatCenterX = beatIndex * beatFullWidth + beatFullWidth / 2;

                // Convert to viewport coordinates
                const x = canvasRect.left + beatCenterX;
                const y = canvasRect.top;

                // Check if tooltip would go off-screen and adjust position
                const tooltipHeight = 80; // Approximate tooltip height
                const viewportHeight = window.innerHeight;
                const spaceAbove = y;
                const spaceBelow = viewportHeight - y - canvasRect.height;

                if (spaceAbove > tooltipHeight && spaceBelow < tooltipHeight) {
                    // Show above - arrow points down
                    this.tooltipPosition = "above";
                    this.tooltipY = y - 10;
                } else {
                    // Show below - arrow points up
                    this.tooltipPosition = "below";
                    this.tooltipY = y + canvasRect.height + 10;
                }

                // Ensure tooltip doesn't go off the left or right edge
                const tooltipWidth = 120; // Approximate tooltip width
                let adjustedX = x;

                if ((x - tooltipWidth / 2) < 10) {
                    adjustedX = tooltipWidth / 2 + 10;
                } else if ((x + tooltipWidth / 2) > (window.innerWidth - 10)) {
                    adjustedX = window.innerWidth - tooltipWidth / 2 - 10;
                }

                this.tooltipX = adjustedX;
                this.tooltipVisible = true;
            }, 150);
        },

        /**
         * Hide custom tooltip
         * @param {boolean} resetHoverIndex Whether to reset the hovered beat index
         * @returns {void}
         */
        hideTooltip(resetHoverIndex = true) {
            if (this.tooltipTimeoutId) {
                clearTimeout(this.tooltipTimeoutId);
                this.tooltipTimeoutId = null;
            }

            this.tooltipVisible = false;
            this.tooltipContent = null;

            if (resetHoverIndex) {
                this.hoveredBeatIndex = -1;
            }
        },

        /**
         * Draw all beats on the canvas
         * @returns {void}
         */
        drawCanvas() {
            const canvas = this.$refs.canvas;
            if (!canvas) {
                return;
            }

            const ctx = canvas.getContext("2d");
            const dpr = window.devicePixelRatio || 1;

            // Set canvas size accounting for device pixel ratio for crisp rendering
            canvas.width = this.canvasWidth * dpr;
            canvas.height = this.canvasHeight * dpr;
            canvas.style.width = this.canvasWidth + "px";
            canvas.style.height = this.canvasHeight + "px";
            ctx.scale(dpr, dpr);

            // Clear canvas
            ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

            const beatFullWidth = this.beatWidth + (this.beatHoverAreaPadding * 2);
            const centerY = this.canvasHeight / 2;

            // Cache CSS colors once per redraw
            const rootStyles = getComputedStyle(document.documentElement);
            const canvasStyles = getComputedStyle(canvas.parentElement);
            const colors = {
                empty: canvasStyles.getPropertyValue("--beat-empty-color") || "#f0f8ff",
                down: rootStyles.getPropertyValue("--bs-danger") || "#dc3545",
                pending: rootStyles.getPropertyValue("--bs-warning") || "#ffc107",
                maintenance: rootStyles.getPropertyValue("--maintenance") || "#1d4ed8",
                up: rootStyles.getPropertyValue("--bs-primary") || "#5cdd8b",
            };

            // Draw each beat
            this.shortBeatList.forEach((beat, index) => {
                const x = index * beatFullWidth + this.beatHoverAreaPadding;
                const isHovered = index === this.hoveredBeatIndex;

                let width = this.beatWidth;
                let height = this.beatHeight;
                let offsetX = x;
                let offsetY = centerY - height / 2;

                // Apply hover scale
                if (isHovered && beat !== 0) {
                    width *= this.hoverScale;
                    height *= this.hoverScale;
                    offsetX = x - (width - this.beatWidth) / 2;
                    offsetY = centerY - height / 2;
                }

                // Calculate border radius based on current width (pill shape = half of width)
                const borderRadius = width / 2;

                // Get color based on beat status
                let color = this.getBeatColor(beat, colors);

                // Draw beat rectangle
                ctx.fillStyle = color;
                this.roundRect(ctx, offsetX, offsetY, width, height, borderRadius);
                ctx.fill();

                // Apply hover opacity
                if (isHovered && beat !== 0) {
                    ctx.globalAlpha = 0.8;
                    ctx.fillStyle = color;
                    this.roundRect(ctx, offsetX, offsetY, width, height, borderRadius);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
            });
        },

        /**
         * Draw a rounded rectangle
         * @param {CanvasRenderingContext2D} ctx Canvas context
         * @param {number} x X position
         * @param {number} y Y position
         * @param {number} width Width
         * @param {number} height Height
         * @param {number} radius Border radius
         * @returns {void}
         */
        roundRect(ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        },

        /**
         * Get color for a beat based on its status
         * @param {object} beat Beat object
         * @param {object} colors Cached CSS colors
         * @returns {string} CSS color
         */
        getBeatColor(beat, colors) {
            if (beat === 0 || beat === null || beat?.status === null) {
                return colors.empty;
            }

            const status = Number(beat.status);

            if (status === DOWN) {
                return colors.down;
            } else if (status === PENDING) {
                return colors.pending;
            } else if (status === MAINTENANCE) {
                return colors.maintenance;
            } else {
                return colors.up;
            }
        },

        /**
         * Update tooltip when hovering a new beat
         * @param {object} beat Beat data
         * @param {number} beatIndex Index of the beat
         * @param {DOMRect} rect Canvas bounding rectangle
         * @returns {void}
         */
        updateTooltipOnHover(beat, beatIndex, rect) {
            const previousIndex = this.hoveredBeatIndex;
            this.hoveredBeatIndex = beatIndex;

            if (previousIndex !== -1) {
                // Hide previous tooltip and show new one after brief delay
                this.hideTooltip(false);
                setTimeout(() => {
                    if (this.hoveredBeatIndex === beatIndex) {
                        this.showTooltip(beat, beatIndex, rect);
                    }
                }, 50);
            } else {
                this.showTooltip(beat, beatIndex, rect);
            }
        },

        /**
         * Handle mouse move on canvas for hover detection
         * @param {MouseEvent} event Mouse event
         * @returns {void}
         */
        handleMouseMove(event) {
            const canvas = this.$refs.canvas;
            if (!canvas) {
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const beatFullWidth = this.beatWidth + (this.beatHoverAreaPadding * 2);
            const beatIndex = Math.floor(x / beatFullWidth);

            if (beatIndex >= 0 && beatIndex < this.shortBeatList.length) {
                const beat = this.shortBeatList[beatIndex];

                if (beat !== 0 && beat !== null) {
                    if (this.hoveredBeatIndex !== beatIndex) {
                        this.updateTooltipOnHover(beat, beatIndex, rect);
                    }
                } else {
                    this.hoveredBeatIndex = -1;
                    this.hideTooltip(true);
                }
            } else {
                this.hoveredBeatIndex = -1;
                this.hideTooltip(true);
            }
        },

        /**
         * Handle click on canvas (for accessibility)
         * @param {MouseEvent} event Mouse event
         * @returns {void}
         */
        handleClick(event) {
            // For future accessibility features if needed
            this.handleMouseMove(event);
        },

        /**
         * Handle keyboard navigation on canvas
         * @param {KeyboardEvent} event Keyboard event
         * @returns {void}
         */
        handleKeydown(event) {
            const validIndices = this.shortBeatList
                .map((beat, index) => (beat !== 0 && beat !== null) ? index : -1)
                .filter(index => index !== -1);

            if (validIndices.length === 0) {
                return;
            }

            let newIndex = this.hoveredBeatIndex;

            if (event.key === "ArrowRight") {
                event.preventDefault();
                // Find next valid beat
                const currentPos = validIndices.indexOf(this.hoveredBeatIndex);
                if (currentPos === -1) {
                    newIndex = validIndices[0];
                } else if (currentPos < validIndices.length - 1) {
                    newIndex = validIndices[currentPos + 1];
                }
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                // Find previous valid beat
                const currentPos = validIndices.indexOf(this.hoveredBeatIndex);
                if (currentPos === -1) {
                    newIndex = validIndices[validIndices.length - 1];
                } else if (currentPos > 0) {
                    newIndex = validIndices[currentPos - 1];
                }
            } else if (event.key === "Home") {
                event.preventDefault();
                newIndex = validIndices[0];
            } else if (event.key === "End") {
                event.preventDefault();
                newIndex = validIndices[validIndices.length - 1];
            } else if (event.key === "Escape") {
                event.preventDefault();
                this.hoveredBeatIndex = -1;
                this.hideTooltip();
                return;
            } else {
                return;
            }

            if (newIndex !== this.hoveredBeatIndex && newIndex !== -1) {
                const beat = this.shortBeatList[newIndex];
                const canvas = this.$refs.canvas;
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    this.updateTooltipOnHover(beat, newIndex, rect);
                }
            }
        },

        /**
         * Handle canvas focus
         * @returns {void}
         */
        handleFocus() {
            // Select first valid beat on focus if none selected
            if (this.hoveredBeatIndex === -1) {
                const firstValidIndex = this.shortBeatList.findIndex(beat => beat !== 0 && beat !== null);
                if (firstValidIndex !== -1) {
                    const beat = this.shortBeatList[firstValidIndex];
                    const canvas = this.$refs.canvas;
                    if (canvas) {
                        const rect = canvas.getBoundingClientRect();
                        this.updateTooltipOnHover(beat, firstValidIndex, rect);
                    }
                }
            }
        },

        /**
         * Handle canvas blur
         * @returns {void}
         */
        handleBlur() {
            this.hoveredBeatIndex = -1;
            this.hideTooltip();
        },

    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.wrap {
    overflow: hidden;
    width: 100%;
    white-space: nowrap;
}

.hp-bar-big {
    --beat-empty-color: #f0f8ff;

    .dark & {
        --beat-empty-color: #848484;
    }

    .heartbeat-canvas {
        display: block;
        cursor: pointer;
    }
}

.word {
    color: $secondary-text;
    font-size: 12px;
}

.connecting-line {
    flex-grow: 1;
    height: 1px;
    background-color: #ededed;
    margin-left: 10px;
    margin-right: 10px;
    margin-top: 2px;

    .dark & {
        background-color: #333;
    }
}
</style>
