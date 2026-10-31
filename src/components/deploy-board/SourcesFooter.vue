<template>
    <footer class="db-sources">
        <span v-for="item in items" :key="item.id" class="db-source" :class="'is-' + item.tone">
            {{ item.name }}
            <b>{{ item.text }}</b>
        </span>
    </footer>
</template>

<script>
/** Sources the server reads, in the order they are shown. Kuma (read by this page) comes first. */
const SERVER_SOURCES = [
    { id: "cluster", nameKey: "deployBoardSourceCluster", webhook: false },
    { id: "bitbucket", nameKey: "deployBoardSourceBitbucket", webhook: true },
    { id: "github", nameKey: "deployBoardSourceGithub", webhook: true },
    { id: "amplify", nameKey: "deployBoardSourceAmplify", webhook: false },
];

export default {
    props: {
        /** `sources` of the board snapshot, or null before the first read */
        sources: {
            type: Object,
            default: null,
        },
        /** Whether the socket to Kuma is up */
        kumaConnected: {
            type: Boolean,
            required: true,
        },
        /** Current time, in ms */
        now: {
            type: Number,
            required: true,
        },
        /** Formats a duration in ms */
        formatDuration: {
            type: Function,
            required: true,
        },
    },

    computed: {
        /** @returns {object[]} One entry per source: name, text and tone */
        items() {
            const items = [
                {
                    id: "kuma",
                    name: "Uptime Kuma",
                    text: this.kumaConnected
                        ? this.$t("deployBoardSourceConnected")
                        : this.$t("deployBoardSourceStale"),
                    tone: this.kumaConnected ? "ok" : "warn",
                },
            ];

            for (const source of SERVER_SOURCES) {
                items.push({
                    id: source.id,
                    name: this.$t(source.nameKey),
                    ...this.describe(source, this.sources?.[source.id]),
                });
            }
            return items;
        },
    },

    methods: {
        /**
         * Text and tone of one server source.
         * @param {object} source Entry of SERVER_SOURCES.
         * @param {object|undefined} state Source state from the snapshot.
         * @returns {{text: string, tone: string}} What to show.
         */
        describe(source, state) {
            if (!state) {
                return { text: this.$t("deployBoardReading"), tone: "muted" };
            }
            if (state.state === "unconfigured") {
                return { text: this.$t("deployBoardSourceUnconfigured"), tone: "muted" };
            }
            if (state.state === "stale") {
                const text = state.detail
                    ? `${this.$t("deployBoardSourceStale")} · ${state.detail}`
                    : this.$t("deployBoardSourceStale");
                return { text, tone: "warn" };
            }
            if (!state.lastDataAt) {
                return { text: this.$t("deployBoardSourceWaiting"), tone: "ok" };
            }
            const ago = this.formatDuration(this.now - state.lastDataAt);
            const key = source.webhook ? "deployBoardSourceLastEvent" : "deployBoardSourceRead";
            return { text: this.$t(key, [ago]), tone: "ok" };
        },
    },
};
</script>

<style lang="scss" scoped>
.db-sources {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4em 1.3em;
    padding-top: 0.6em;
    border-top: 1px solid var(--db-line);
    font-size: 0.8em;
    color: var(--db-ink-3);
}

.db-source {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;

    &::before {
        content: "";
        width: 0.55em;
        height: 0.55em;
        border-radius: 50%;
        background: var(--db-ok);
    }

    b {
        font-weight: 600;
        color: var(--db-ink-2);
    }

    &.is-warn::before {
        background: var(--db-warn);
    }

    &.is-muted::before {
        background: var(--db-line-2);
    }
}
</style>
