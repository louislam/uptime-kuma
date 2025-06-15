<template>
    <teleport to="body">
        <div
            v-if="visible && content"
            ref="tooltip"
            class="tooltip-wrapper"
            :style="tooltipStyle"
            :class="{ 'tooltip-above': position === 'above' }"
        >
            <div class="tooltip-content">
                <slot :content="content">
                    <!-- Default content if no slot provided -->
                    <div class="tooltip-status" :class="statusClass">
                        {{ statusText }}
                    </div>
                    <div class="tooltip-time">{{ timeText }}</div>
                    <div v-if="message" class="tooltip-message">{{ message }}</div>
                </slot>
            </div>
            <div class="tooltip-arrow" :class="{ 'arrow-above': position === 'above' }"></div>
        </div>
    </teleport>
</template>

<script>
export default {
    name: "Tooltip",
    props: {
        /** Whether tooltip is visible */
        visible: {
            type: Boolean,
            default: false
        },
        /** Content object to display */
        content: {
            type: Object,
            default: null
        },
        /** X position (viewport coordinates) */
        x: {
            type: Number,
            default: 0
        },
        /** Y position (viewport coordinates) */
        y: {
            type: Number,
            default: 0
        },
        /** Position relative to target element */
        position: {
            type: String,
            default: "below",
            validator: (value) => [ "above", "below" ].includes(value)
        }
    },
    computed: {
        tooltipStyle() {
            return {
                left: this.x + "px",
                top: this.y + "px",
            };
        },

        statusText() {
            if (!this.content || this.content === 0) {
                return this.$t("Unknown");
            }

            const statusMap = {
                0: this.$t("Down"),
                1: this.$t("Up"),
                2: this.$t("Pending"),
                3: this.$t("Maintenance")
            };
            return statusMap[this.content.status] || this.$t("Unknown");
        },

        statusClass() {
            if (!this.content || this.content === 0) {
                return "status-empty";
            }

            const classMap = {
                0: "status-down",
                1: "status-up",
                2: "status-pending",
                3: "status-maintenance"
            };
            return classMap[this.content.status] || "status-unknown";
        },

        timeText() {
            if (!this.content || this.content === 0) {
                return "";
            }
            return this.$root.datetime(this.content.time);
        },

        message() {
            if (!this.content || this.content === 0) {
                return "";
            }
            return this.content.msg || "";
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.tooltip-wrapper {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    transform: translateX(-50%);

    .tooltip-content {
        background: rgba(17, 24, 39, 0.95);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(75, 85, 99, 0.3);
        border-radius: 8px;
        padding: 8px 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
        min-width: 120px;
        text-align: center;

        .tooltip-status {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;

            &.status-up {
                color: $primary;
            }

            &.status-down {
                color: $danger;
            }

            &.status-pending {
                color: $warning;
            }

            &.status-maintenance {
                color: $maintenance;
            }

            &.status-empty {
                color: $secondary-text;
            }
        }

        .tooltip-time {
            color: #d1d5db;
            font-size: 11px;
            margin-bottom: 2px;
        }

        .tooltip-message {
            color: #f3f4f6;
            font-size: 10px;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px solid rgba(75, 85, 99, 0.3);
        }
    }

    .tooltip-arrow {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;

        // Default: tooltip below element, arrow points up
        border-bottom: 6px solid rgba(17, 24, 39, 0.95);
        top: -6px;

        &.arrow-above {
            // Tooltip above element, arrow points down
            top: auto;
            bottom: -6px;
            border-bottom: none;
            border-top: 6px solid rgba(17, 24, 39, 0.95);
        }
    }

    // Smooth entrance animation
    animation: tooltip-fade-in 0.2s $easing-out;

    &.tooltip-above {
        transform: translateX(-50%) translateY(-8px);
    }
}

// Dark theme adjustments
.dark .tooltip-wrapper {
    .tooltip-content {
        background: rgba(31, 41, 55, 0.95);
        border-color: rgba(107, 114, 128, 0.3);
    }

    .tooltip-arrow {
        border-bottom-color: rgba(31, 41, 55, 0.95);

        &.arrow-above {
            border-top-color: rgba(31, 41, 55, 0.95);
        }
    }
}

@keyframes tooltip-fade-in {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}

// Accessibility improvements

@media (prefers-reduced-motion: reduce) {
    .tooltip-wrapper {
        animation: none !important;
    }
}
</style>
