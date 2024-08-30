<template>
    <div class="monitor-condition mb-3" data-testid="condition">
        <button
            v-if="!isInGroup || !isFirst || !isLast"
            class="btn btn-outline-danger remove-button"
            type="button"
            :aria-label="$t('conditionDelete')"
            data-testid="remove-condition"
            @click="remove"
        >
            <font-awesome-icon icon="trash" />
        </button>

        <select v-if="!isFirst" v-model="model.andOr" class="form-select and-or-select" data-testid="condition-and-or">
            <option value="and">{{ $t("and") }}</option>
            <option value="or">{{ $t("or") }}</option>
        </select>

        <select v-model="model.variable" class="form-select" data-testid="condition-variable">
            <option
                v-for="variable in conditionVariables"
                :key="variable.id"
                :value="variable.id"
            >
                {{ $t(variable.id) }}
            </option>
        </select>

        <select v-model="model.operator" class="form-select" data-testid="condition-operator">
            <option
                v-for="operator in getVariableOperators(model.variable)"
                :key="operator.id"
                :value="operator.id"
            >
                {{ $t(operator.caption) }}
            </option>
        </select>

        <input
            v-model="model.value"
            type="text"
            class="form-control"
            :aria-label="$t('conditionValuePlaceholder')"
            data-testid="condition-value"
            required
        />
    </div>
</template>

<script>
export default {
    name: "EditMonitorCondition",

    props: {
        /**
         * The monitor condition
         */
        modelValue: {
            type: Object,
            required: true,
        },

        /**
         * Whether this is the first condition
         */
        isFirst: {
            type: Boolean,
            required: true,
        },

        /**
         * Whether this is the last condition
         */
        isLast: {
            type: Boolean,
            required: true,
        },

        /**
         * Whether this condition is in a group
         */
        isInGroup: {
            type: Boolean,
            required: false,
            default: false,
        },

        /**
         * Variable choices
         */
        conditionVariables: {
            type: Array,
            required: true,
        },
    },

    emits: [ "update:modelValue", "remove" ],

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
        remove() {
            this.$emit("remove", this.model);
        },

        getVariableOperators(variableId) {
            return this.conditionVariables.find(v => v.id === variableId)?.operators ?? [];
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.monitor-condition {
    display: flex;
    flex-wrap: wrap;
}

.remove-button {
    justify-self: flex-end;
    margin-bottom: 12px;
    margin-left: auto;
}

@container (min-width: 500px) {
    .monitor-condition {
        display: flex;
        flex-wrap: nowrap;
    }

    .remove-button {
        margin-bottom: 0;
        margin-left: 10px;
        order: 100;
    }

    .and-or-select {
        width: auto;
    }
}
</style>
