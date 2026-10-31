<template>
    <div class="db-incidents" :class="{ 'is-compact': compact }">
        <div v-for="monitor in monitors" :key="monitor.id" class="db-incident" :class="'is-' + monitor.tone">
            <div class="db-incident-top">
                <span class="db-incident-name">{{ monitor.name }}</span>
                <span class="db-incident-state">{{ monitor.stateText }}</span>
            </div>
            <span v-if="!compact" class="db-beats" aria-hidden="true">
                <i v-for="(beat, i) in monitor.beats" :key="i" :class="'b-' + beat"></i>
            </span>
        </div>
    </div>
</template>

<script>
/**
 * Above this many monitors the cards drop the history bars and shrink. Every monitor stays on
 * screen: a block that says "and N more" stops answering "what is down?".
 */
const COMPACT_ABOVE = 6;

export default {
    props: {
        /** Monitors that are down or pending: { id, name, tone, stateText, beats } */
        monitors: {
            type: Array,
            required: true,
        },
    },

    computed: {
        /** @returns {boolean} Whether the block uses the compact cards */
        compact() {
            return this.monitors.length > COMPACT_ABOVE;
        },
    },
};
</script>

<style lang="scss" scoped>
.db-incidents {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20em), 1fr));
    gap: var(--db-gap);

    &.is-compact {
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 15em), 1fr));
    }
}

.db-incident {
    display: grid;
    gap: 0.45em;
    min-width: 0;
    padding: 0.75em 1em;
    border-radius: 10px;
    background: var(--db-bad-soft);
    border: 1px solid color-mix(in srgb, var(--db-bad) 55%, var(--db-line));
    animation: db-alarm 1.6s ease-in-out infinite;

    &.is-pending {
        background: var(--db-warn-soft);
        border-color: color-mix(in srgb, var(--db-warn) 55%, var(--db-line));
        animation: none;
    }
}

.is-compact .db-incident {
    padding: 0.5em 0.75em;
}

.db-incident-top {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2em 0.7em;
}

.db-incident-name {
    font-size: 1.35em;
    font-weight: 800;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
}

.is-compact .db-incident-name {
    font-size: 1.05em;
}

.db-incident-state {
    font-weight: 700;
    color: var(--db-bad);
}

.is-pending .db-incident-state {
    color: var(--db-warn);
}

.db-beats {
    display: flex;
    gap: 2px;
    height: 1.1em;

    i {
        flex: 0 1 6px;
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

@keyframes db-alarm {
    0%,
    100% {
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--db-bad) 0%, transparent);
    }

    50% {
        box-shadow: 0 0 0 0.3em color-mix(in srgb, var(--db-bad) 30%, transparent);
    }
}

@media (prefers-reduced-motion: reduce) {
    .db-incident {
        animation: none;
    }
}
</style>
