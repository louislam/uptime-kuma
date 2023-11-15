<template>
    <div class="input-group mb-3">
        <select ref="select" v-model="model" class="form-select" :disabled="disabled" :required="required">
            <option v-for="option in options" :key="option" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
        </select>
        <a class="btn btn-outline-primary" :class="{ disabled: actionDisabled }" @click="action()">
            <font-awesome-icon :icon="icon" />
        </a>
    </div>
</template>

<script>
/**
 * Generic select field with a customizable action on the right.
 * Action is passed in as a function.
 */
export default {
    props: {
        options: {
            type: Array,
            default: () => [],
        },
        /**
         * The value of the select field.
         */
        modelValue: {
            type: Number,
            default: null,
        },
        /**
         * Whether the select field is enabled / disabled.
         */
        disabled: {
            type: Boolean,
            default: false
        },
        /**
         * The icon displayed in the right button of the select field.
         * Accepts a Font Awesome icon string identifier.
         * @example "plus"
         */
        icon: {
            type: String,
            required: true,
        },
        /**
         * The action to be performed when the button is clicked.
         * Action is passed in as a function.
         */
        action: {
            type: Function,
            default: () => {},
        },
        /**
         * Whether the action button is disabled.
         * @example true
         */
        actionDisabled: {
            type: Boolean,
            default: false
        },
        /**
         * Whether the select field is required.
         * @example true
         */
        required: {
            type: Boolean,
            default: false,
        }
    },
    emits: [ "update:modelValue" ],
    computed: {
        /**
         * Send value update to parent on change.
         */
        model: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit("update:modelValue", value);
            }
        }
    },
};
</script>
