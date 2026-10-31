<template>
    <section class="db-deploys" :aria-label="$t('deployBoardDeploys')">
        <h2 class="db-section-title">{{ $t("deployBoardDeploys") }}</h2>

        <p v-if="!board" class="db-empty">{{ $t("deployBoardReading") }}</p>
        <p v-else-if="noSourceOn" class="db-empty">{{ $t("deployBoardNoSources") }}</p>
        <p v-else-if="board.deploys.length === 0" class="db-empty">{{ $t("deployBoardNoActiveDeploys") }}</p>

        <div class="db-history">
            <h3 class="db-subtitle">{{ $t("deployBoardHistory") }}</h3>
            <p v-if="!board || board.history.length === 0" class="db-muted">{{ $t("deployBoardHistoryEmpty") }}</p>
        </div>
    </section>
</template>

<script>
export default {
    props: {
        /** Board snapshot from the server, or null before the first read */
        board: {
            type: Object,
            default: null,
        },
    },

    computed: {
        /** @returns {boolean} True when no deploy source is configured at all */
        noSourceOn() {
            return Object.values(this.board.sources).every((s) => s.state === "unconfigured");
        },
    },
};
</script>

<style lang="scss" scoped>
.db-deploys {
    display: flex;
    flex-direction: column;
    gap: 0.8em;
    min-width: 0;
    min-height: 0;
}

.db-section-title {
    margin: 0;
    font-size: 0.8em;
    font-weight: 800;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--db-ink-2);
}

.db-subtitle {
    margin: 0;
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: var(--db-ink-3);
}

.db-empty {
    margin: 0;
    padding: 0.9em 1em;
    border: 1px dashed var(--db-line-2);
    border-radius: 10px;
    color: var(--db-ink-2);
    text-wrap: pretty;
}

.db-history {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    margin-top: auto;
}

.db-muted {
    margin: 0;
    font-size: 0.9em;
    color: var(--db-ink-3);
}
</style>
