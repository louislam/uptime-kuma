<template>
    <div class="mb-3">
        <label for="kwtsms-username" class="form-label">{{ $t("API Username") }}</label>
        <i18n-t tag="div" class="form-text" keypath="kwtsmsApiCredentialsDescription">
            <template #here>
                <a href="https://www.kwtsms.com/cportal/" target="_blank">{{ $t("here") }}</a>
            </template>
        </i18n-t>
        <input
            id="kwtsms-username"
            v-model="$parent.notification.kwtsmsUsername"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <label for="kwtsms-password" class="form-label">{{ $t("Password") }}</label>
        <HiddenInput
            id="kwtsms-password"
            v-model="$parent.notification.kwtsmsPassword"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="kwtsms-sender-id" class="form-label">{{ $t("kwtsmsSenderId") }}</label>
        <input
            id="kwtsms-sender-id"
            v-model="$parent.notification.kwtsmsSenderId"
            type="text"
            maxlength="11"
            class="form-control"
            placeholder="KWT-SMS"
        />
        <div class="form-text">{{ $t("kwtsmsSenderIdDescription") }}</div>
    </div>
    <div class="mb-3">
        <label for="kwtsms-to-number" class="form-label">{{ $t("Recipient Number") }}</label>
        <input
            id="kwtsms-to-number"
            v-model="$parent.notification.kwtsmsToNumber"
            type="text"
            class="form-control"
            placeholder="965XXXXXXXX"
            required
        />
        <div class="form-text">{{ $t("kwtsmsRecipientDescription") }}</div>
    </div>
    <div class="mb-3">
        <div class="form-check form-switch">
            <input
                id="kwtsms-test-mode"
                v-model="$parent.notification.kwtsmsTestMode"
                class="form-check-input"
                type="checkbox"
            />
            <label for="kwtsms-test-mode" class="form-check-label">{{ $t("kwtsmsTestMode") }}</label>
        </div>
        <div class="form-text">{{ $t("kwtsmsTestModeDescription") }}</div>
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
