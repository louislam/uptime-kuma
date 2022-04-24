<template>
    <div class="input-group mb-3">
        <input
            ref="input"
            v-model="model"
            :type="visibility"
            class="form-control"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :autocomplete="autocomplete"
            :required="required"
            :readonly="readonly"
        >

        <a v-if="visibility == 'password'" class="btn btn-outline-primary" @click="showInput()">
            <font-awesome-icon icon="eye" />
        </a>
        <a v-if="visibility == 'text'" class="btn btn-outline-primary" @click="hideInput()">
            <font-awesome-icon icon="eye-slash" />
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
        placeholder: {
            type: String,
            default: ""
        },
        maxlength: {
            type: Number,
            default: 255
        },
        autocomplete: {
            type: String,
            default: undefined,
        },
        required: {
            type: Boolean
        },
        readonly: {
            type: String,
            default: undefined,
        },
    },
    emits: [ "update:modelValue" ],
    data() {
        return {
            visibility: "password",
        };
    },
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
        showInput() {
            this.visibility = "text";
        },
        hideInput() {
            this.visibility = "password";
        },
    }
};
</script>
