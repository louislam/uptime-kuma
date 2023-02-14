<template>
    <div class="mb-3">
        <label for="splunk-rest-url" class="form-label">{{ $t("Splunk Rest URL") }}</label>
        <HiddenInput id="splunk-rest-url" v-model="$parent.notification.splunkRestURL" :required="true" autocomplete="false"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="splunk-severity" class="form-label">{{ $t("Severity") }}</label>
        <select id="splunk-severity" v-model="$parent.notification.splunkSeverity" class="form-select">
            <option value="INFO">{{ $t("info") }}</option>
            <option value="WARNING">{{ $t("warning") }}</option>
            <option value="CRITICAL" selected="selected">{{ $t("critical") }}</option>
        </select>
    </div>
    <div class="mb-3">
        <label for="splunk-resolve" class="form-label">{{ $t("Auto resolve or acknowledged") }}</label>
        <select id="splunk-resolve" v-model="$parent.notification.splunkAutoResolve" class="form-select">
            <option value="0" selected="selected">{{ $t("do nothing") }}</option>
            <option value="ACKNOWLEDGEMENT">{{ $t("auto acknowledged") }}</option>
            <option value="RECOVERY">{{ $t("auto resolve") }}</option>
        </select>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
