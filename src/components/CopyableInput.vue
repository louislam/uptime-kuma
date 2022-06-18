<template>
    <div class="input-group">
        <input
            :id="id"
            ref="input"
            v-model="model"
            :type="type"
            class="form-control"
            :placeholder="placeholder"
            :autocomplete="autocomplete"
            :required="required"
            :readonly="readonly"
            :disabled="disabled"
        >

        <a class="btn btn-outline-primary" @click="copyToClipboard(model)">
            <font-awesome-icon :icon="icon" />
        </a>
    </div>
</template>

<script>

let timeout;

export default {
    props: {
        /** ID of this input */
        id: {
            type: String,
            default: ""
        },
        /** Type of input */
        type: {
            type: String,
            default: "text"
        },
        /** The value of the input */
        modelValue: {
            type: String,
            default: ""
        },
        /** A placeholder to use */
        placeholder: {
            type: String,
            default: ""
        },
        /** Should the field auto complete */
        autocomplete: {
            type: String,
            default: undefined,
        },
        /** Is the input required? */
        required: {
            type: Boolean
        },
        /** Should the input be read only? */
        readonly: {
            type: String,
            default: undefined,
        },
        /** Is the input disabled? */
        disabled: {
            type: String,
            default: undefined,
        },
    },
    emits: [ "update:modelValue" ],
    data() {
        return {
            visibility: "password",
            icon: "copy",
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

        /** Show the input */
        showInput() {
            this.visibility = "text";
        },

        /** Hide the input */
        hideInput() {
            this.visibility = "password";
        },

        /**
         * Copy the provided text to the users clipboard
         * @param {string} textToCopy
         * @returns {Promise<void>}
         */
        copyToClipboard(textToCopy) {
            this.icon = "check";

            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.icon = "copy";
            }, 3000);

            // navigator clipboard api needs a secure context (https)
            if (navigator.clipboard && window.isSecureContext) {
                // navigator clipboard api method'
                return navigator.clipboard.writeText(textToCopy);
            } else {
                // text area method
                let textArea = document.createElement("textarea");
                textArea.value = textToCopy;
                // make the textarea out of viewport
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                return new Promise((res, rej) => {
                    // here the magic happens
                    document.execCommand("copy") ? res() : rej();
                    textArea.remove();
                });
            }
        }

    }
};
</script>
