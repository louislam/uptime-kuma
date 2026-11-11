<template>
    <teleport to="body">
        <div
            v-if="content"
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
                    <div v-if="content?.msg" class="tooltip-message">{{ content.msg }}</div>
                </slot>
            </div>
            <div class="tooltip-arrow" :class="{ 'arrow-above': position === 'above' }"></div>
        </div>
    </teleport>
</template>

<script>
import { DOWN, UP, PENDING, MAINTENANCE } from "../util.ts";

export default {
    name: "Tooltip",
    props: {
        /** Whether tooltip is visible */
        visible: {
            type: Boolean,
            default: false,
        },
        /** Content object to display */
        content: {
            type: Object,
            default: null,
        },
        /** X position (viewport coordinates) */
        x: {
            type: Number,
            default: 0,
        },
        /** Y position (viewport coordinates) */
        y: {
            type: Number,
            default: 0,
        },
        /** Position relative to target element */
        position: {
            type: String,
            default: "below",
            validator: (value) => ["above", "below"].includes(value),
        },
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

            switch (this.content.status) {
                case DOWN:
                    return this.$t("Down");
                case UP:
                    return this.$t("Up");
                case PENDING:
                    return this.$t("Pending");
                case MAINTENANCE:
                    return this.$t("Maintenance");
                default:
                    return this.$t("Unknown");
            }
        },

        statusClass() {
            if (!this.content || this.content === 0) {
                return "status-empty";
            }

            switch (this.content.status) {
                case DOWN:
                    return "status-down";
                case UP:
                    return "status-up";
                case PENDING:
                    return "status-pending";
                case MAINTENANCE:
                    return "status-maintenance";
                default:
                    return "status-unknown";
            }
        },

        timeText() {
            if (!this.content || this.content === 0) {
                return "";
            }
            return this.$root.datetime(this.content.time);
        },
    },
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
        background: var(--bg-raised);
        backdrop-filter: none;
        border: var(--stroke) solid var(--border-strong);
        border-radius: var(--radius-md);
        padding: 8px 12px;
        box-shadow: none;
        min-width: 120px;
        text-align: center;
        position: relative;

        &::before {
            content: "";
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 14px;
            height: 2px;
            background: var(--bg-raised);
            top: -1px;
        }

        .tooltip-status {
            font: 500 11px/16px var(--font-mono);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.08em;

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
            color: var(--text-muted);
            font: 400 13px/18px var(--font-mono);
            margin-bottom: 2px;
        }

        .tooltip-message {
            color: var(--text);
            font-size: 12px;
            margin-top: 4px;
            padding-top: 4px;
            border-top: var(--stroke) solid var(--border);
        }
    }

    .tooltip-arrow {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 12px;
        height: 6px;
        overflow: hidden;
        top: -6px;

        &::before {
            content: "";
            position: absolute;
            left: 50%;
            top: 100%;
            transform: translateX(-50%) translateY(-50%) rotate(45deg);
            width: 8px;
            height: 8px;
            background: var(--bg-raised);
            border: var(--stroke) solid var(--border-strong);
            border-bottom: none;
            border-right: none;
        }

        &.arrow-above {
            top: auto;
            bottom: -6px;

            &::before {
                top: 0%;
                transform: translateX(-50%) translateY(-50%) rotate(225deg);
                border: var(--stroke) solid var(--border-strong);
                border-bottom: none;
                border-right: none;
            }
        }
    }

    // Smooth entrance animation
    animation: tooltip-fade-in 0.2s $easing-out;

    &.tooltip-above {
        transform: translateX(-50%) translateY(-8px);

        .tooltip-content::before {
            top: auto;
            bottom: -1px;
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
