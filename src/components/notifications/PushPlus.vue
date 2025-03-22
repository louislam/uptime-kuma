<template>
    <div class="mb-3">
        <label for="pushPlus-sendkey" class="form-label">{{ $t("SendKey") }}</label>
        <HiddenInput id="pushPlus-sendkey" v-model="$parent.notification.pushPlusSendKey" :required="true" autocomplete="new-password"></HiddenInput>
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