<template>
    <div class="mb-3">
        <label for="pushdeer-key" class="form-label">{{ $t("PushDeer Key") }}</label>
        <HiddenInput id="pushdeer-key" v-model="$parent.notification.pushdeerKey" :required="true" autocomplete="one-time-code" placeholder="PDUxxxx"></HiddenInput>
    </div>

    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="http://www.pushdeer.com/" rel="noopener noreferrer" target="_blank">http://www.pushdeer.com/</a>
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
