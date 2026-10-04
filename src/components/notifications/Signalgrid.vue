<template>
    <div class="mb-3">
        <label for="signalgrid-client-key" class="form-label">{{ $t("Client Key") }}</label>
        <HiddenInput
            id="signalgrid-client-key"
            v-model="$parent.notification.signalgridClientKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="signalgrid-channel" class="form-label">{{ $t("Channel") }}</label>
        <input
            id="signalgrid-channel"
            v-model="$parent.notification.signalgridChannel"
            type="text"
            class="form-control"
            required
        />
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
