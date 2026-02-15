<template>
    <div class="mb-3">
        <label for="m-target-key" class="form-label">Clé API (X-API-KEY)</label>
        <HiddenInput id="m-target-key" v-model="$parent.notification.mTargetApiKey" :required="true"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="m-target-number" class="form-label">Numéro de téléphone (msisdn)</label>
        <input
            id="m-target-number"
            v-model="$parent.notification.mTargetNumber"
            type="text"
            class="form-control"
            placeholder="+33612345678"
            required
        />
    </div>
    <div class="mb-3">
        <label for="m-target-sender" class="form-label">Expéditeur (Sender ID)</label>
        <input
            id="m-target-sender"
            v-model="$parent.notification.mTargetSender"
            type="text"
            maxlength="11"
            class="form-control"
            placeholder="UptimeKuma"
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
