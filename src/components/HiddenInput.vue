<template>
    <div class="input-group mb-3" :class="{ floating: label }">
        <div v-if="label" class="form-floating">
            <input
                :id="inputId"
                ref="input"
                v-model="model"
                :type="visibility"
                class="form-control"
                :placeholder="label"
                :maxlength="maxlength"
                :autocomplete="autocomplete"
                :required="required"
                :readonly="readonly"
            />
            <label :for="inputId">{{ label }}</label>
        </div>
        <input
            v-else
            ref="input"
            v-model="model"
            :type="visibility"
            class="form-control"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :autocomplete="autocomplete"
            :required="required"
            :readonly="readonly"
        />

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
        /** The value of the input */
        modelValue: {
            type: String,
            default: "",
        },
        /** A placeholder to use */
        placeholder: {
            type: String,
            default: "",
        },
        /** Label shown inside the input (floating label style). Replaces the placeholder when set */
        label: {
            type: String,
            default: "",
        },
        /** The id of the input element, used to link the floating label */
        inputId: {
            type: String,
            default: undefined,
        },
        /** Maximum length of the input */
        maxlength: {
            type: Number,
            default: 255,
        },
        /** Should the field auto complete */
        autocomplete: {
            type: String,
            default: "new-password",
        },
        /** Is the input required? */
        required: {
            type: Boolean,
        },
        /** Should the input be read only? */
        readonly: {
            type: String,
            default: undefined,
        },
    },
    emits: ["update:modelValue"],
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
            },
        },
    },
    created() {},
    methods: {
        /**
         * Show users input in plain text
         * @returns {void}
         */
        showInput() {
            this.visibility = "text";
        },
        /**
         * Censor users input
         * @returns {void}
         */
        hideInput() {
            this.visibility = "password";
        },
    },
};
</script>

<style lang="scss" scoped>
// Bootstrap 5.1 has no support for .form-floating inside .input-group
.floating {
    > .form-floating {
        flex: 1 1 auto;
        width: 1%;
        min-width: 0;

        > label,
        > .form-control {
            padding-left: 1.3rem;
        }

        > .form-control {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
        }
    }

    > .btn {
        display: flex;
        align-items: center;
    }
}
</style>
