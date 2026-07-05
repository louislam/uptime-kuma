<template>
    <div class="dependency-graph">
        <div ref="cyContainer" class="cy-container"></div>

        <div class="graph-legend">
            <span v-for="item in statusLegend" :key="item.status" class="legend-item">
                <span class="legend-dot" :style="{ backgroundColor: item.color }"></span>
                {{ item.label }}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line-hard"></span>
                {{ $t("Hard") }}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line-soft"></span>
                {{ $t("Soft") }}
            </span>
        </div>

        <div class="dependency-editor mt-3">
            <h5>{{ $t("Dependencies") }}</h5>

            <table v-if="edges.length > 0" class="table">
                <thead>
                    <tr>
                        <th>{{ $t("Name") }}</th>
                        <th></th>
                        <th>{{ $t("Depends on") }}</th>
                        <th>{{ $t("Type") }}</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="edge in edges" :key="edge.id">
                        <td>{{ nameOf(edge.monitorID) }}</td>
                        <td>→</td>
                        <td>{{ nameOf(edge.dependsOnMonitorID) }}</td>
                        <td>
                            <select
                                class="form-select"
                                :value="edge.relationType"
                                @change="editEdge(edge, $event.target.value)"
                            >
                                <option value="hard">{{ $t("Hard") }}</option>
                                <option value="soft">{{ $t("Soft") }}</option>
                            </select>
                        </td>
                        <td>
                            <button class="btn btn-outline-danger" @click="removeEdge(edge)">
                                <font-awesome-icon icon="trash" />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="row g-2 align-items-center">
                <div class="col-auto">
                    <select v-model="newEdge.monitorID" class="form-select">
                        <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </div>
                <div class="col-auto">{{ $t("Depends on") }}</div>
                <div class="col-auto">
                    <select v-model="newEdge.dependsOnMonitorID" class="form-select">
                        <option v-for="m in validDependsOnOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </div>
                <div class="col-auto">
                    <select v-model="newEdge.relationType" class="form-select">
                        <option value="hard">{{ $t("Hard") }}</option>
                        <option value="soft">{{ $t("Soft") }}</option>
                    </select>
                </div>
                <div class="col-auto">
                    <button class="btn btn-primary" @click="addEdge">
                        {{ $t("Add") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import { getMonitorRelativeURL } from "../util.ts";
import { canReach as canReachUtil } from "../dependency-graph-utils";

cytoscape.use(dagre);

// Keep in sync with server/../src/util.ts status constants and badgeConstants colors
const STATUS_COLOR = {
    0: "#c2290a", // DOWN
    1: "#66c20a", // UP
    2: "#f8a306", // PENDING
    3: "#1747f5", // MAINTENANCE
    4: "#9c27b0", // UNREACHABLE
};
const UNKNOWN_COLOR = "#999";
const EDGE_COLOR = "#8a8a8a";
const EDGE_COLOR_SOFT = "#b0b0b0";

export default {
    props: {
        monitorId: {
            type: Number,
            required: true,
        },
    },

    data() {
        return {
            edges: [],
            newEdge: {
                monitorID: null,
                dependsOnMonitorID: null,
                relationType: "hard",
            },
            cy: null,
        };
    },

    computed: {
        members() {
            return Object.values(this.$root.monitorList).filter((m) => m.parent === this.monitorId);
        },

        memberIDs() {
            return new Set(this.members.map((m) => m.id));
        },

        memberStatuses() {
            // Track each member's latest status so the graph re-renders on live updates
            return this.members.map((m) => this.statusOf(m.id)).join(",");
        },

        statusLegend() {
            return [
                { status: 1, color: STATUS_COLOR[1], label: this.$t("Up") },
                { status: 0, color: STATUS_COLOR[0], label: this.$t("Down") },
                { status: 2, color: STATUS_COLOR[2], label: this.$t("Pending") },
                { status: 4, color: STATUS_COLOR[4], label: this.$t("Unreachable") },
                { status: 3, color: STATUS_COLOR[3], label: this.$t("Maintenance") },
            ];
        },

        /**
         * Candidates for "depends on" given the currently selected dependent
         * monitor: excludes itself, edges that already exist, and any monitor
         * that would close a cycle (i.e. can already reach the dependent
         * through existing edges).
         * @returns {Array} Valid member monitors to depend on
         */
        validDependsOnOptions() {
            const monitorID = this.newEdge.monitorID;

            if (!monitorID) {
                return this.members;
            }

            return this.members.filter((m) => {
                if (m.id === monitorID) {
                    return false;
                }

                const alreadyExists = this.edges.some(
                    (e) => e.monitorID === monitorID && e.dependsOnMonitorID === m.id
                );
                if (alreadyExists) {
                    return false;
                }

                // Would edge monitorID -> m.id close a cycle? True if m.id can
                // already (transitively) reach monitorID via existing edges.
                return !this.canReach(m.id, monitorID);
            });
        },
    },

    watch: {
        memberStatuses() {
            this.renderGraph();
        },
        edges() {
            this.renderGraph();
        },
        "newEdge.monitorID"() {
            if (!this.validDependsOnOptions.some((m) => m.id === this.newEdge.dependsOnMonitorID)) {
                this.newEdge.dependsOnMonitorID = null;
            }
        },
    },

    mounted() {
        this.loadEdges();
    },

    beforeUnmount() {
        if (this.cy) {
            this.cy.destroy();
        }
    },

    methods: {
        nameOf(id) {
            const m = this.$root.monitorList[id];
            return m ? m.name : `#${id}`;
        },

        statusOf(id) {
            const list = this.$root.heartbeatList[id];
            if (!list || list.length === 0) {
                return null;
            }
            return list[list.length - 1].status;
        },

        /**
         * Checks whether `target` is reachable from `fromID` by following
         * existing "depends on" edges. Uses the same canReach() traversal as
         * the server-side cycle check in MonitorDependency.wouldCreateCycle.
         * @param {number} fromID Starting monitor ID
         * @param {number} target Monitor ID to look for
         * @returns {boolean} True if target is reachable from fromID
         */
        canReach(fromID, target) {
            return canReachUtil(this.edges, fromID, target);
        },

        loadEdges() {
            this.$root.getSocket().emit("getMonitorDependencyList", (res) => {
                if (res.ok) {
                    this.edges = res.monitorDependencyList.filter(
                        (e) => this.memberIDs.has(e.monitorID) && this.memberIDs.has(e.dependsOnMonitorID)
                    );
                }
            });
        },

        addEdge() {
            const { monitorID, dependsOnMonitorID, relationType } = this.newEdge;

            if (!monitorID || !dependsOnMonitorID) {
                return;
            }

            this.$root
                .getSocket()
                .emit("addMonitorDependency", monitorID, dependsOnMonitorID, relationType, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.loadEdges();
                    }
                });
        },

        editEdge(edge, relationType) {
            this.$root.getSocket().emit("editMonitorDependency", edge.id, relationType, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadEdges();
                }
            });
        },

        removeEdge(edge) {
            this.$root.getSocket().emit("deleteMonitorDependency", edge.id, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadEdges();
                }
            });
        },

        renderGraph() {
            if (!this.$refs.cyContainer) {
                return;
            }

            const nodes = this.members.map((m) => ({
                data: { id: String(m.id), label: m.name },
            }));

            const edgeEls = this.edges.map((e) => ({
                data: {
                    id: `e${e.id}`,
                    source: String(e.monitorID),
                    target: String(e.dependsOnMonitorID),
                },
                classes: e.relationType === "soft" ? "soft" : "hard",
            }));

            const elements = [ ...nodes, ...edgeEls ];

            if (!this.cy) {
                this.cy = cytoscape({
                    container: this.$refs.cyContainer,
                    elements,
                    style: [
                        {
                            selector: "node",
                            style: {
                                label: "data(label)",
                                "background-color": (el) => this.colorFor(el.data("id")),
                                "border-width": 2,
                                "border-color": "rgba(0, 0, 0, 0.2)",
                                color: "#fff",
                                "font-size": 13,
                                "font-weight": 600,
                                "text-outline-width": 2,
                                "text-outline-color": (el) => this.colorFor(el.data("id")),
                                "text-valign": "center",
                                "text-halign": "center",
                                "text-wrap": "wrap",
                                "text-max-width": "110px",
                                width: "label",
                                height: 40,
                                padding: "14px",
                                shape: "round-rectangle",
                                "transition-property": "border-width, border-color",
                                "transition-duration": 120,
                            },
                        },
                        {
                            selector: "node.hovered",
                            style: {
                                "border-width": 4,
                                "border-color": "rgba(0, 0, 0, 0.4)",
                            },
                        },
                        {
                            selector: "edge",
                            style: {
                                width: 2.5,
                                "line-color": EDGE_COLOR,
                                "target-arrow-color": EDGE_COLOR,
                                "target-arrow-shape": "triangle",
                                "arrow-scale": 1.2,
                                "curve-style": "bezier",
                            },
                        },
                        {
                            selector: "edge.soft",
                            style: {
                                "line-style": "dashed",
                                "line-color": EDGE_COLOR_SOFT,
                                "target-arrow-color": EDGE_COLOR_SOFT,
                            },
                        },
                    ],
                    layout: { name: "dagre", rankDir: "LR", nodeSep: 35, rankSep: 70 },
                    minZoom: 0.3,
                    maxZoom: 2,
                });

                this.cy.on("mouseover", "node", (evt) => {
                    evt.target.addClass("hovered");
                    this.$refs.cyContainer.style.cursor = "pointer";
                });
                this.cy.on("mouseout", "node", (evt) => {
                    evt.target.removeClass("hovered");
                    this.$refs.cyContainer.style.cursor = "default";
                });
                this.cy.on("tap", "node", (evt) => {
                    this.$router.push(getMonitorRelativeURL(evt.target.id()));
                });
            } else {
                this.cy.elements().remove();
                this.cy.add(elements);
                this.cy.style().update();
                this.cy.layout({ name: "dagre", rankDir: "LR", nodeSep: 35, rankSep: 70 }).run();
            }
        },

        colorFor(id) {
            const status = this.statusOf(Number(id));
            if (status === null || status === undefined) {
                return UNKNOWN_COLOR;
            }
            return STATUS_COLOR[status] || UNKNOWN_COLOR;
        },
    },
};
</script>

<style lang="scss" scoped>
.cy-container {
    width: 100%;
    height: 320px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    background:
        radial-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px) 0 0 / 18px 18px;
}

.dark .cy-container {
    border-color: rgba(255, 255, 255, 0.12);
    background:
        radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px) 0 0 / 18px 18px;
}

.graph-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 10px;
    font-size: 13px;
    color: var(--bs-secondary-color, #666);

    .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .legend-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .legend-line {
        display: inline-block;
        width: 22px;
        height: 0;
        border-top: 2px solid #8a8a8a;
    }

    .legend-line-soft {
        border-top: 2px dashed #b0b0b0;
    }
}
</style>
