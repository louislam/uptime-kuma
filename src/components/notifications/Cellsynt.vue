<template>
    <div class="mb-3">
        <label for="cellsynt-login" class="form-label">{{ $t("Username") }}</label>
        <input id="cellsynt-login" v-model="$parent.notification.cellsyntLogin" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="cellsynt-key" class="form-label">{{ $t("Password") }}</label>
        <HiddenInput id="cellsynt-key" v-model="$parent.notification.cellsyntPassword" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="cellsynt-Originatortype" class="form-label">{{ $t("Originator type") }}</label>
        <select id="cellsynt-Originatortype" v-model="$parent.notification.cellsyntOriginatortype" :required="true" class="form-select">
            <option value="alpha">{{ $t("Alphanumeric (recommended)") }}</option>
            <option value="numeric">{{ $t("Telephone number") }}</option>
        </select>
        <div class="form-text">
            <p><b>{{ $t("Alphanumeric (recommended)") }}:</b><br /> {{ $t("cellsyntOriginatortypeAlphanumeric") }}</p>
            <p><b>{{ $t("Telephone number") }}:</b><br /> {{ $t("cellsyntOriginatortypeNumeric") }}</p>
        </div>
    </div>
    <div class="mb-3">
        <label for="cellsynt-originator" class="form-label">{{ $t("Originator") }} <small>({{ $parent.notification.cellsyntOriginatortype === 'alpha' ? $t("max 11 alphanumeric characters") : $t("max 15 digits") }})</small></label>
        <input v-if="$parent.notification.cellsyntOriginatortype === 'alpha'" id="cellsynt-originator" v-model="$parent.notification.cellsyntOriginator" type="text" class="form-control" pattern="[a-zA-Z0-9\s]+" maxlength="11" required>
        <input v-else id="cellsynt-originator" v-model="$parent.notification.cellsyntOriginator" type="number" class="form-control" pattern="[0-9]+" maxlength="15" required>
        <div class="form-text"><p>{{ $t("cellsyntOriginator") }}</p></div>
    </div>
    <div class="mb-3">
        <label for="cellsynt-destination" class="form-label">{{ $t("Destination") }}</label>
        <input id="cellsynt-destination" v-model="$parent.notification.cellsyntDestination" type="text" class="form-control" required>
        <div class="form-text"><p>{{ $t("cellsyntDestination") }}</p></div>
    </div>
    <div class="form-check form-switch">
        <input id="cellsynt-allow-long" v-model="$parent.notification.cellsyntAllowLongSMS" type="checkbox" class="form-check-input">
        <label for="cellsynt-allow-long" class="form-label">{{ $t("Allow Long SMS") }}</label>
        <div class="form-text">{{ $t("cellsyntSplitLongMessages") }}</div>
    </div>
    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://www.cellsynt.com/en/" target="_blank">https://www.cellsynt.com/en/</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput
    },
    mounted() {
        this.$parent.notification.cellsyntOriginatortype ||= "alpha";
        this.$parent.notification.cellsyntOriginator ||= "uptimekuma";
    }
};
</script>
