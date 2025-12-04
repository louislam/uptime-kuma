<template>
    <div class="mb-3">
        <label for="mobivate-key" class="form-label">{{ $t("API Key") }}<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="mobivate-key" v-model="$parent.notification.mobivateApikey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="mobivate-recipients" class="form-label">{{ $t("mobivateRecipients") }}</label>
        <input id="mobivate-recipients" v-model="$parent.notification.mobivateRecipients" type="text" minlength="3" maxlength="20" pattern="^[\d+,]+$" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="mobivate-originator" class="form-label">{{ $t("mobivateOriginator") }}</label>
        <input id="mobivate-originator" v-model="$parent.notification.mobivateOriginator" type="text" minlength="3" maxlength="15" pattern="^[a-zA-Z0-9]*$" class="form-control" required>
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
