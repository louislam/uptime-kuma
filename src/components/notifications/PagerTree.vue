<template>
    <div class="mb-3">
        <label for="pagertree-integration-url" class="form-label">{{ $t("pagertreeIntegrationUrl") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="pagertree-integration-url" v-model="$parent.notification.pagertreeIntegrationUrl" type="text" class="form-control" autocomplete="false">
    </div>
    <div class="mb-3">
        <label for="pagertree-urgency" class="form-label">{{ $t("pagertreeUrgency") }}</label>
        <select id="pagertree-urgency" v-model="$parent.notification.pagertreeUrgency" class="form-select">
            <option value="silent">{{ $t("pagertreeSilent") }}</option>
            <option value="low">{{ $t("pagertreeLow") }}</option>
            <option value="medium" selected="selected">{{ $t("pagertreeMedium") }}</option>
            <option value="high">{{ $t("pagertreeHigh") }}</option>
            <option value="critical">{{ $t("pagertreeCritical") }}</option>
        </select>
    </div>
    <div class="mb-3">
        <label for="pagertree-resolve" class="form-label">{{ $t("pagertreeResolve") }}</label>
        <select id="pagertree-resolve" v-model="$parent.notification.pagertreeAutoResolve" class="form-select">
            <option value="resolve" selected="selected">{{ $t("pagertreeResolve") }}</option>
            <option value="0">{{ $t("pagertreeDoNothing") }}</option>
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
