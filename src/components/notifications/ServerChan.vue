<template>
    <div class="mb-3">
        <label for="serverchan-sendkey" class="form-label">{{ $t("SendKey") }}</label>
        <HiddenInput id="serverchan-sendkey" v-model="$parent.notification.serverChanSendKey" :required="true" autocomplete="new-password"></HiddenInput>
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
