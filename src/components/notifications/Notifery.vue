<template>
    <div class="mb-3">
        <label for="notifery-api-key" class="form-label">{{
            $t("API Key")
        }}</label>
        <HiddenInput
            id="notifery-api-key"
            v-model="$parent.notification.notiferyApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="notifery-title" class="form-label">{{ $t("Title") }}</label>
        <input
            id="notifery-title"
            v-model="$parent.notification.notiferyTitle"
            type="text"
            class="form-control"
            placeholder="Uptime Kuma Alert"
        />
    </div>

    <div class="mb-3">
        <label for="notifery-group" class="form-label">{{ $t("Group") }}</label>
        <input
            id="notifery-group"
            v-model="$parent.notification.notiferyGroup"
            type="text"
            class="form-control"
            :placeholder="$t('Optional')"
        />
    </div>

    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://docs.notifery.com/api/event/" target="_blank">https://docs.notifery.com/api/event/</a>
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
