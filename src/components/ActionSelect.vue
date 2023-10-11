<template>
    <div class="input-group mb-3">
        <select ref="select" v-model="model" class="form-select" :disabled="disabled">
            <option v-for="option in options" :key="option" :value="option.value">{{ option.label }}</option>
        </select>
        <a class="btn btn-outline-primary" @click="action()">
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
