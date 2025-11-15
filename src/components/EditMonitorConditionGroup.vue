<template>
    <div class="condition-group mb-3" data-testid="condition-group">
        <div class="d-flex">
            <select v-if="!isFirst" v-model="model.andOr" class="form-select" style="width: auto;" data-testid="condition-group-and-or">
                <option value="and">{{ $t("and") }}</option>
                <option value="or">{{ $t("or") }}</option>
            </select>
        </div>

        <div class="condition-group-inner mt-2 pa-2">
            <div class="condition-group-conditions">
                <template v-for="(child, childIndex) in model.children" :key="childIndex">
                    <EditMonitorConditionGroup
                        v-if="child.type === 'group'"
                        v-model="model.children[childIndex]"
                        :is-first="childIndex === 0"
                        :get-new-group="getNewGroup"
                        :get-new-condition="getNewCondition"
                        :condition-variables="conditionVariables"
                        @remove="removeChild"
                    />
                    <EditMonitorCondition
                        v-else
                        v-model="model.children[childIndex]"
                        :is-first="childIndex === 0"
                        :is-last="childIndex === model.children.length - 1"
                        :is-in-group="true"
                        :condition-variables="conditionVariables"
                        @remove="removeChild"
                    />
                </template>
            </div>

            <div class="condition-group-actions mt-3">
                <button class="btn btn-outline-secondary me-2" type="button" data-testid="add-condition-button" @click="addCondition">
                    {{ $t("conditionAdd") }}
                </button>
                <button class="btn btn-outline-secondary me-2" type="button" data-testid="add-group-button" @click="addGroup">
                    {{ $t("conditionAddGroup") }}
                </button>
                <button
                    class="btn btn-outline-danger"
                    type="button"
                    :aria-label="$t('conditionDeleteGroup')"
                    data-testid="remove-condition-group"
                    @click="remove"
                >
                    <font-awesome-icon icon="trash" />
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import EditMonitorCondition from "./EditMonitorCondition.vue";

export default {
    name: "EditMonitorConditionGroup",

    components: {
        EditMonitorCondition,
    },

    props: {
        /**
         * The condition group
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
         * Function to generate a new group model
         */
        getNewGroup: {
            type: Function,
            required: true,
        },

        /**
         * Function to generate a new condition model
         */
        getNewCondition: {
            type: Function,
            required: true,
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
        addGroup() {
            const conditions = [ ...this.model.children ];
            conditions.push(this.getNewGroup());
            this.model.children = conditions;
        },

        addCondition() {
            const conditions = [ ...this.model.children ];
            conditions.push(this.getNewCondition());
            this.model.children = conditions;
        },

        remove() {
            this.$emit("remove", this.model);
        },

        removeChild(child) {
            const idx = this.model.children.indexOf(child);
            if (idx !== -1) {
                this.model.children.splice(idx, 1);
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.condition-group-inner {
    background: rgba(0, 0, 0, 0.05);
    padding: 20px;
}

.dark .condition-group-inner {
    background: rgba(255, 255, 255, 0.05);
}

.condition-group-conditions {
    container-type: inline-size;
}

.condition-group-actions {
    display: grid;
    gap: 10px;
}

// Delete button
.condition-group-actions > :last-child {
    margin-left: auto;
    margin-top: 14px;
}

@container (min-width: 400px) {
    .condition-group-actions {
        display: flex;
    }

    // Delete button
    .condition-group-actions > :last-child {
        margin-left: auto;
        margin-top: 0;
    }

    .btn-delete-group {
        margin-left: auto;
    }
}
</style>
