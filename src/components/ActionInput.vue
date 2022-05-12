<template>
    <div class="input-group mb-3">
        <input
            ref="input"
            v-model="model"
            class="form-control"
            :type="type"
            :placeholder="placeholder"
            :disabled="!enabled"
        >
        <a class="btn btn-outline-primary" @click="action()">
            <font-awesome-icon :icon="icon" />
        </a>
    </div>
</template>

<script>
export default {
    props: {
        modelValue: {
            type: String,
            default: ""
        },
        enabled: {
            type: Boolean,
            default: true
        },
        placeholder: {
            type: String,
            default: ""
        },
        icon: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            default: "text",
        },
        action: {
            type: Function,
            default: () => {},
        }
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
    created() {

    },
    methods: {
    }
};
</script>
