<template>
    <div class="monitor-dependency-editor">
        <table v-if="modelValue.length > 0" class="table table-sm align-middle mb-2">
            <tbody>
                <tr v-for="(dep, index) in modelValue" :key="dep.id || 'new' + index">
                    <td>{{ nameOf(dep.dependsOnMonitorID) }}</td>
                    <td class="type-cell">
                        <select
                            class="form-select"
                            :value="dep.relationType"
                            @change="setType(index, $event.target.value)"
                        >
                            <option value="hard">{{ $t("Hard") }}</option>
                            <option value="soft">{{ $t("Soft") }}</option>
                        </select>
                    </td>
                    <td class="action-cell">
                        <button type="button" class="btn btn-outline-danger" @click="remove(index)">
                            <font-awesome-icon icon="trash" />
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>

        <div class="row g-2 align-items-center">
            <div class="col-auto flex-grow-1">
                <select v-model="newDep.dependsOnMonitorID" class="form-select">
                    <option :value="null" hidden></option>
                    <option v-for="m in candidates" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
            </div>
            <div class="col-auto">
                <select v-model="newDep.relationType" class="form-select">
                    <option value="hard">{{ $t("Hard") }}</option>
                    <option value="soft">{{ $t("Soft") }}</option>
                </select>
            </div>
            <div class="col-auto">
                <button type="button" class="btn btn-primary" :disabled="!newDep.dependsOnMonitorID" @click="add">
                    {{ $t("Add") }}
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import { canReach } from "../dependency-graph-utils";

export default {
    name: "MonitorDependencyEditor",
    props: {
        /** Dependency rows: { id?, dependsOnMonitorID, relationType } */
        modelValue: {
            type: Array,
            required: true,
        },
        /**
         * ID of the monitor being edited, so it can be excluded from the
         * candidate list and cycle-creating candidates can be filtered out.
         * Null when adding a new monitor (no cycles possible yet).
         */
        excludeMonitorId: {
            type: Number,
            default: null,
        },
    },
    emits: [ "update:modelValue" ],
    data() {
        return {
            newDep: {
                dependsOnMonitorID: null,
                relationType: "hard",
            },
            // All of the user's existing dependency edges, for cycle filtering
            allEdges: [],
        };
    },
    computed: {
        candidates() {
            const chosen = new Set(this.modelValue.map((d) => d.dependsOnMonitorID));

            return Object.values(this.$root.monitorList)
                .filter((m) => {
                    if (m.id === this.excludeMonitorId || chosen.has(m.id)) {
                        return false;
                    }

                    // Would "excludeMonitorId depends on m" close a cycle? True if
                    // m can already (transitively) reach it via existing edges.
                    if (this.excludeMonitorId != null && canReach(this.allEdges, m.id, this.excludeMonitorId)) {
                        return false;
                    }

                    return true;
                })
                .sort((a, b) => a.name.localeCompare(b.name));
        },
    },
    mounted() {
        if (this.excludeMonitorId != null) {
            this.loadEdges();
        }
    },
    methods: {
        nameOf(id) {
            const m = this.$root.monitorList[id];
            return m ? m.name : `#${id}`;
        },

        loadEdges() {
            this.$root.getSocket().emit("getMonitorDependencyList", (res) => {
                if (res.ok) {
                    this.allEdges = res.monitorDependencyList;
                }
            });
        },

        add() {
            if (!this.newDep.dependsOnMonitorID) {
                return;
            }

            this.$emit("update:modelValue", [
                ...this.modelValue,
                {
                    dependsOnMonitorID: this.newDep.dependsOnMonitorID,
                    relationType: this.newDep.relationType,
                },
            ]);

            this.newDep.dependsOnMonitorID = null;
            this.newDep.relationType = "hard";
        },

        remove(index) {
            const rows = [ ...this.modelValue ];
            rows.splice(index, 1);
            this.$emit("update:modelValue", rows);
        },

        setType(index, relationType) {
            const rows = this.modelValue.map((row, i) => (i === index ? { ...row, relationType } : row));
            this.$emit("update:modelValue", rows);
        },
    },
};
</script>

<style lang="scss" scoped>
.type-cell {
    width: 130px;
}

.action-cell {
    width: 1%;
    white-space: nowrap;
}
</style>
