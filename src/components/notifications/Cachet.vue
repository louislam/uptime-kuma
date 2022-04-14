<template>
    <div class="mb-3">
        <label for="cachetUrl" class="form-label">{{ $t("Cachet URL") }}</label>
        <input id="cachetUrl" v-model="$parent.notification.cachetUrl" type="text" class="form-control" :required="true" autocomplete="false">
    </div>

    <div class="mb-3">
        <label for="cachetToken" class="form-label">{{ $t("Cachet API Token") }}</label>
        <HiddenInput id="cachetToken" v-model="$parent.notification.cachetToken" :required="true" autocomplete="one-time-code"></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="cachetComponentId" class="form-label">{{ $t("Component ID") }}</label>
        <input id="cachetComponentId" v-model="$parent.notification.cachetComponentId" type="text" class="form-control" :required="true" autocomplete="false">
    </div>

    <div class="mb-3">
        <label for="cachetFatalState" class="form-label">{{ $t("Fatal State") }}</label>
        <select id="cachetFatalState" v-model="$parent.notification.cachetFatalState" class="form-select" :required="true">
            <option :value="4" :selected="true">{{ $t("Major Outage") }}</option>
            <option :value="3">{{ $t("Partial Outage") }}</option>
            <option :value="2">{{ $t("Performance Issues") }}</option>
            <option :value="0">{{ $t("Unknown") }}</option>
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
