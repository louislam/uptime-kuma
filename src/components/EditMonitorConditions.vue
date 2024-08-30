<template>
    <div class="monitor-conditions">
        <label class="form-label">{{ $t("Conditions") }}</label>
        <div class="monitor-conditions-conditions">
            <template v-for="(condition, conditionIndex) in model" :key="conditionIndex">
                <EditMonitorConditionGroup
                    v-if="condition.type === 'group'"
                    v-model="model[conditionIndex]"
                    :is-first="conditionIndex === 0"
                    :get-new-group="getNewGroup"
                    :get-new-condition="getNewCondition"
                    :condition-variables="conditionVariables"
                    @remove="removeCondition"
                />
                <EditMonitorCondition
                    v-else
                    v-model="model[conditionIndex]"
                    :is-first="conditionIndex === 0"
                    :is-last="conditionIndex === model.length - 1"
                    :condition-variables="conditionVariables"
                    @remove="removeCondition"
                />
            </template>
        </div>
        <div class="monitor-conditions-buttons">
            <button class="btn btn-outline-secondary me-2" type="button" data-testid="add-condition-button" @click="addCondition">
                {{ $t("conditionAdd") }}
            </button>
            <button class="btn btn-outline-secondary me-2" type="button" data-testid="add-group-button" @click="addGroup">
                {{ $t("conditionAddGroup") }}
            </button>
        </div>
    </div>
</template>

<script>
import EditMonitorConditionGroup from "./EditMonitorConditionGroup.vue";
import EditMonitorCondition from "./EditMonitorCondition.vue";

export default {
    name: "EditMonitorConditions",

    components: {
        EditMonitorConditionGroup,
        EditMonitorCondition,
    },

    props: {
        /**
         * The monitor conditions
         */
        modelValue: {
            type: Array,
            required: true,
        },

        conditionVariables: {
            type: Array,
            required: true,
        },
    },

    emits: [ "update:modelValue" ],

    computed: {
        model: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit("update:modelValue", value);
            }
        }
    },

    methods: {
        getNewGroup() {
            return {
                type: "group",
                children: [ this.getNewCondition() ],
                andOr: "and",
            };
        },

        getNewCondition() {
            const firstVariable = this.conditionVariables[0]?.id || null;
            const firstOperator = this.getVariableOperators(firstVariable)[0] || null;
            return {
                type: "expression",
                variable: firstVariable,
                operator: firstOperator?.id || null,
                value: "",
                andOr: "and",
            };
        },

        addGroup() {
            const conditions = [ ...this.model ];
            conditions.push(this.getNewGroup());
            this.$emit("update:modelValue", conditions);
        },

        addCondition() {
            const conditions = [ ...this.model ];
            conditions.push(this.getNewCondition());
            this.$emit("update:modelValue", conditions);
        },

        removeCondition(condition) {
            const conditions = [ ...this.model ];
            const idx = conditions.indexOf(condition);
            if (idx !== -1) {
                conditions.splice(idx, 1);
                this.$emit("update:modelValue", conditions);
            }
        },

        getVariableOperators(variableId) {
            return this.conditionVariables.find(v => v.id === variableId)?.operators ?? [];
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.monitor-conditions,
.monitor-conditions-conditions {
    container-type: inline-size;
}

.monitor-conditions-buttons {
    display: grid;
    gap: 10px;
}

@container (min-width: 400px) {
    .monitor-conditions-buttons {
        display: flex;
    }
}
</style>
