<template>
    <div class="form-text mb-2">
        <i18n-t tag="div" keypath="liquidIntroduction">
            <a href="https://liquidjs.com/" target="_blank">{{ $t("documentation") }}</a>
        </i18n-t>

        <code v-pre>{{ msg }}</code>: {{ $t("templateMsg") }}<br />
        <code v-pre>{{ name }}</code>: {{ $t("templateServiceName") }}<br />
        <code v-pre>{{ status }}</code>: {{ $t("templateStatus") }}<br />
        <code v-pre>{{ hostnameOrURL }}</code>: {{ $t("templateHostnameOrURL") }}<br />
        <code v-pre>{{ heartbeatJSON }}</code>: {{ $t("templateHeartbeatJSON") }} <b>({{ $t("templateLimitedToUpDownNotifications") }})</b><br />
        <code v-pre>{{ monitorJSON }}</code>: {{ $t("templateMonitorJSON") }} <b>({{ $t("templateLimitedToUpDownCertNotifications") }})</b><br />
    </div>

    <textarea
        :id="id"
        ref="templatedTextarea"
        v-model="model"
        class="form-control"
        :placeholder="placeholder"
        :required="required"
        autocomplete="false"
    ></textarea>
</template>

<script>
export default {
    props: {
        /**
         * The value of the templated textarea.
         */
        modelValue: {
            type: String,
            default: ""
        },
        /**
         * id for the templated textarea.
         */
        id: {
            type: String,
            required: true,
        },
        /**
         * Whether the templated textarea is required.
         * @example true
         */
        required: {
            type: Boolean,
            required: true,
        },
        /**
         * Placeholder text for the templated textarea.
         */
        placeholder: {
            type: String,
            default: ""
        },
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

<style lang="scss" scoped>
textarea {
    min-height: 150px;
}
</style>
