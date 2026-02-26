<template>
    <div class="mb-3">
        <label for="serwersms-username" class="form-label">{{ $t("serwersmsAPIUser") }}</label>
        <input
            id="serwersms-username"
            v-model="$parent.notification.serwersmsUsername"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <label for="serwersms-key" class="form-label">{{ $t("serwersmsAPIPassword") }}</label>
        <HiddenInput
            id="serwersms-key"
            v-model="$parent.notification.serwersmsPassword"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="serwersms-recipient-type" class="form-label">{{ $t("serwersmsRecipientType") }}</label>
        <select id="serwersms-recipient-type" v-model="$parent.notification.serwersmsRecipientType" class="form-select">
            <option value="phone">{{ $t("serwersmsRecipientTypePhone") }}</option>
            <option value="group">{{ $t("serwersmsRecipientTypeGroup") }}</option>
        </select>
    </div>
    <div v-if="$parent.notification.serwersmsRecipientType !== 'group'" class="mb-3">
        <label for="serwersms-phone-number" class="form-label">{{ $t("serwersmsPhoneNumber") }}</label>
        <input
            id="serwersms-phone-number"
            v-model="$parent.notification.serwersmsPhoneNumber"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div v-if="$parent.notification.serwersmsRecipientType === 'group'" class="mb-3">
        <label for="serwersms-group-id" class="form-label">{{ $t("serwersmsGroupId") }}</label>
        <input
            id="serwersms-group-id"
            v-model="$parent.notification.serwersmsGroupId"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">{{ $t("serwersmsGroupIdHelptext") }}</div>
    </div>
    <div class="mb-3">
        <label for="serwersms-sender-name" class="form-label">{{ $t("serwersmsSenderName") }}</label>
        <input
            id="serwersms-sender-name"
            v-model="$parent.notification.serwersmsSenderName"
            type="text"
            minlength="3"
            maxlength="11"
            class="form-control"
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
