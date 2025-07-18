<template>
    <div class="mb-3">
        <label for="serwersms-username" class="form-label">{{ $t('serwersmsAPIUser') }}</label>
        <input id="serwersms-username" type="text" v-model="$parent.notification.serwersmsUsername" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="serwersms-key" class="form-label">{{ $t('serwersmsAPIPassword') }}</label>
        <HiddenInput id="serwersms-key" v-model="$parent.notification.serwersmsPassword" :required="true" autocomplete="new-password"></HiddenInput>
    </div>

    <div class="mb-3">
        <label class="form-label">{{ $t("serwersmsDestinationType") }}</label><br>
        <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" id="dest-phone" value="phone" v-model="$parent.notification.destinationType" required>
            <label class="form-check-label" for="dest-phone">{{ $t("serwersmsPhoneNumber") }}</label>
        </div>

        <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" id="dest-group" value="group" v-model="$parent.notification.destinationType">
            <label class="form-check-label" for="dest-group">{{ $t("serwersmsGroupId") }}</label>
        </div>
    </div>

    <div class="mb-3">
        <label for="serwersms-destination-value" class="form-label">
            {{ $t($parent.notification.destinationType === 'group' ? 'serwersmsGroupId' : 'serwersmsPhoneNumber') }}
        </label>
        <input id="serwersms-destination-value" type="text" v-model="$parent.notification.destinationValue" class="form-control" required>
        <div v-if="$parent.notification.destinationType === 'group'" class="form-text">{{ $t("serwersmsGroupIdHelp") }}</div>
        <div v-else class="form-text">{{ $t("serwersmsPhoneHelp") }}</div>
    </div>

    <div class="mb-3">
        <label for="serwersms-sender-name" class="form-label">{{ $t("serwersmsSenderName") }}</label>
        <input id="serwersms-sender-name" type="text" v-model="$parent.notification.serwersmsSenderName" minlength="3" maxlength="11" class="form-control">
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
