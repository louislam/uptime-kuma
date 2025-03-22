<template>
    <div class="mb-3">
        <label for="pushplusplus-sendkey" class="form-label">{{ $t("SendKey") }}</label>
        <HiddenInput id="pushplusplus-sendkey" v-model="$parent.notification.pushPlusPlusSendKey" :required="true" autocomplete="new-password"></HiddenInput>
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