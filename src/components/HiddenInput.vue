<template>
    <div class="input-group mb-3">
        <!--
        Hack - Disable Chrome save password
        readonly + onfocus
        https://stackoverflow.com/questions/41217019/how-to-prevent-a-browser-from-storing-passwords
       -->
        <input
            v-model="model"
            :type="visibility"
            class="form-control"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :autocomplete="autocomplete"
            :required="required"
            :readonly="isReadOnly"
            @focus="removeReadOnly"
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
            type: Boolean,
        },
        required: {
            type: Boolean
        },
        readonly: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            visibility: "password",
            readOnlyValue: false,
        }
    },
    computed: {
        model: {
            get() {
                return this.modelValue
            },
            set(value) {
                this.$emit("update:modelValue", value)
            }
        },
        isReadOnly() {
            // Actually readonly from prop
            if (this.readonly) {
                return true;
            }

            // Hack - Disable Chrome save password
            return this.readOnlyValue;
        }
    },
    created() {
        // Hack - Disable Chrome save password
        if (this.autocomplete) {
            this.readOnlyValue = "readonly";
        }
    },
    methods: {
        showInput() {
            this.visibility = "text";
        },
        hideInput() {
            this.visibility = "password";
        },

        // Hack - Disable Chrome save password
        removeReadOnly() {
            if (this.autocomplete) {
                this.readOnlyValue = false;
            }
        }
    }
}
</script>
