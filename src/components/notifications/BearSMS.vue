<template>
    <div class="mb-3">
        <label for="bearsms-username" class="form-label">{{ $t("API Username") }}</label>
        <i18n-t tag="div" class="form-text" keypath="wayToGetBearSMSToken">
            <a href="https://app.bearsms.com/" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
        <input
            id="bearsms-username"
            v-model="$parent.notification.bearsmsUsername"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <label for="bearsms-hashkey" class="form-label">{{ $t("Hash Key") }}</label>
        <HiddenInput
            id="bearsms-hashkey"
            v-model="$parent.notification.bearsmsHashKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="bearsms-senderId" class="form-label">{{ $t("From Name/Number") }}</label>
        <input
            id="bearsms-senderId"
            v-model="$parent.notification.bearsmsSenderId"
            type="text"
            maxlength="11"
            class="form-control"
        />
        <div class="form-text">{{ $t("bearsmsSenderDescription") }}</div>
    </div>
    <div class="mb-3">
        <label for="bearsms-phoneNumber" class="form-label">{{ $t("Recipient Number") }}</label>
        <input
            id="bearsms-phoneNumber"
            v-model="$parent.notification.bearsmsPhoneNumber"
            type="text"
            class="form-control"
            placeholder="9725XXXXXXXX"
            required
        />
        <div class="form-text">{{ $t("bearsmsPhoneNumberDescription") }}</div>
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
