<template>
    <div class="mb-3">
        <label for="pushPlus-sendkey" class="form-label">{{ $t("SendKey") }}</label>
        <HiddenInput id="pushPlus-sendkey" v-model="$parent.notification.pushPlusSendKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <i18n-t tag="div" keypath="More info on:" class="mb-3 form-text">
        <a href="https://www.pushplus.plus/" target="_blank">https://www.pushplus.plus/</a>
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
