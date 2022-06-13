<template>
    <div class="mb-3">
        <label for="pagerduty-integration-key" class="form-label">{{ $t("Integration Key") }}</label>
        <HiddenInput id="pagerduty-integration-key" v-model="$parent.notification.pagerdutyIntegrationKey" :required="true" autocomplete="false"></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetPagerDutyKey" class="form-text">
            <a href="https://support.pagerduty.com/docs/services-and-integrations" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="pagerduty-integration-url" class="form-label">{{ $t("Integration URL") }}</label>
        <input id="pagerduty-integration-url" v-model="$parent.notification.pagerdutyIntegrationUrl" type="text" class="form-control" autocomplete="false">
    </div>
    <div class="mb-3">
        <label for="pagerduty-priority" class="form-label">{{ $t("Priority") }}</label>
        <select id="pagerduty-priority" v-model="$parent.notification.pagerdutyPriority" class="form-select">
            <option value="info">{{ $t("info") }}</option>
            <option value="warning" selected="selected">{{ $t("warning") }}</option>
            <option value="error">{{ $t("error") }}</option>
            <option value="critical">{{ $t("critical") }}</option>
        </select>
    </div>
    <div class="mb-3">
        <label for="pagerduty-resolve" class="form-label">{{ $t("Auto resolve or acknowledged") }}</label>
        <select id="pagerduty-resolve" v-model="$parent.notification.pagerdutyAutoResolve" class="form-select">
            <option value="0" selected="selected">{{ $t("do nothing") }}</option>
            <option value="acknowledge">{{ $t("auto acknowledged") }}</option>
            <option value="resolve">{{ $t("auto resolve") }}</option>
        </select>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.pagerdutyIntegrationUrl === "undefined") {
            this.$parent.notification.pagerdutyIntegrationUrl = "https://events.pagerduty.com/v2/enqueue";
        }
    }
};
</script>
