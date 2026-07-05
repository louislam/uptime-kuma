<template>
    <div class="service-tree">
        <div v-for="row in flatRows" :key="row.id" class="item">
            <div class="row">
                <div class="col-9 col-xl-6 small-padding">
                    <div class="info">
                        <span class="tree-prefix">{{ row.prefix }}</span>
                        <span
                            v-if="row.hasKids"
                            class="collapse-toggle"
                            @click="toggle(row.id)"
                        >
                            <font-awesome-icon
                                icon="chevron-down"
                                class="chevron"
                                :class="{ collapsed: row.collapsed }"
                            />
                        </span>
                        <span v-else class="chevron-spacer"></span>
                        <Status :status="statusOf(row.id)" />
                        <span class="item-name">{{ row.name }}</span>
                        <span v-if="row.collapsed" class="hidden-count">+{{ row.hiddenCount }}</span>
                    </div>
                </div>
                <div :key="$root.userHeartbeatBar" class="col-3 col-xl-6">
                    <HeartbeatBar size="mid" :monitor-id="row.id" />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Status from "./Status.vue";
import HeartbeatBar from "./HeartbeatBar.vue";

const COLLAPSED_STORAGE_KEY = "serviceTreeCollapsed";

/**
 * Reads the persisted set of collapsed node IDs from localStorage.
 * @returns {Set<number>} Collapsed monitor IDs
 */
function loadCollapsed() {
    try {
        return new Set(JSON.parse(localStorage.getItem(COLLAPSED_STORAGE_KEY) || "[]"));
    } catch {
        return new Set();
    }
}

export default {
    name: "ServiceTree",
    components: {
        Status,
        HeartbeatBar,
    },
    props: {
        /** Tree nodes to render: { id, name, kids: [...] } */
        nodes: {
            type: Array,
            required: true,
        },
    },
    data() {
        return {
            collapsed: loadCollapsed(),
        };
    },
    computed: {
        /**
         * Flattens the nested tree into rows with a precomputed
         * box-drawing prefix (like the Unix `tree` command), so the
         * connector lines are derived purely from array position instead
         * of fragile CSS positioning, and every row can share the exact
         * same column layout as the flat monitor list above it.
         * Subtrees of collapsed nodes are skipped.
         * @returns {Array} Flat rows: { id, name, prefix, hasKids, collapsed, hiddenCount }
         */
        flatRows() {
            return this.flatten(this.nodes, []);
        },
    },
    methods: {
        flatten(nodes, ancestorContinues) {
            let rows = [];

            nodes.forEach((node, index) => {
                const isLast = index === nodes.length - 1;

                const prefix =
                    ancestorContinues.map((continues) => (continues ? "│   " : "    ")).join("") +
                    (ancestorContinues.length > 0 ? (isLast ? "└─ " : "├─ ") : "");

                const hasKids = node.kids && node.kids.length > 0;
                const isCollapsed = hasKids && this.collapsed.has(node.id);

                rows.push({
                    id: node.id,
                    name: node.name,
                    prefix,
                    hasKids,
                    collapsed: isCollapsed,
                    hiddenCount: isCollapsed ? this.countDescendants(node) : 0,
                });

                if (hasKids && !isCollapsed) {
                    rows = rows.concat(this.flatten(node.kids, [ ...ancestorContinues, !isLast ]));
                }
            });

            return rows;
        },

        countDescendants(node) {
            let count = 0;
            for (const kid of node.kids || []) {
                count += 1 + this.countDescendants(kid);
            }
            return count;
        },

        toggle(id) {
            if (this.collapsed.has(id)) {
                this.collapsed.delete(id);
            } else {
                this.collapsed.add(id);
            }

            try {
                localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([ ...this.collapsed ]));
            } catch {
                // localStorage unavailable (private mode etc.) — collapse still works for the session
            }
        },

        statusOf(id) {
            const list = this.$root.heartbeatList[id];
            if (!list || list.length === 0) {
                return null;
            }
            return list[list.length - 1].status;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.tree-prefix {
    font-family: "Courier New", Courier, monospace;
    white-space: pre;
    color: rgba(0, 0, 0, 0.35);
}

.dark .tree-prefix {
    color: rgba(255, 255, 255, 0.35);
}

.collapse-toggle {
    cursor: pointer;
    padding: 2px 4px;
}

.chevron-spacer {
    display: inline-block;
    width: 20px;
}

.chevron {
    font-size: 0.8em;
    color: #bbb;
    transition: all 0.2s $easing-in;

    &.collapsed {
        transform: rotate(-90deg);
    }
}

.hidden-count {
    margin-left: 6px;
    font-size: 12px;
    color: #bbb;
}
</style>
