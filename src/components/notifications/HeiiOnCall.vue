<template>
    <div class="mb-3">
        <label for="heiioncall-apikey" class="form-label">{{ $t("API Key") }}<span
            style="color: red;"
        ><sup>*</sup></span></label>
        <HiddenInput
            id="heiioncall-apikey" v-model="$parent.notification.heiiOnCallApiKey" required="true"
            autocomplete="false"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="heiioncall-trigger-id" class="form-label">Trigger ID<span
            style="color: red;"
        ><sup>*</sup></span></label>
        <HiddenInput
            id="heiioncall-trigger-id" v-model="$parent.notification.heiiOnCallTriggerId" required="true"
            autocomplete="false"
        ></HiddenInput>
    </div>
    <i18n-t tag="p" keypath="wayToGetHeiiOnCallDetails" class="form-text mt-3">
        <template #documentation>
            <a href="https://heiioncall.com/docs" target="_blank">{{ $t("documentationOf", ["Heii On-Call"]) }}</a>
        </template>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
export default {
    components: {
        HiddenInput,
    },
};
</script>
