<template>
    <div class="mb-3">
        <label class="form-label" for="threema-recipient">{{ $t("threemaRecipientType") }}</label>
        <select
            id="threema-recipient" v-model="$parent.notification.threemaRecipientType" :required="true"
            class="form-select"
        >
            <option value="identity">{{ $t("threemaRecipientTypeIdentity") }}</option>
            <option value="phone">{{ $t("threemaRecipientTypePhone") }}</option>
            <option value="email">{{ $t("threemaRecipientTypeEmail") }}</option>
        </select>
    </div>
    <div v-if="$parent.notification.threemaRecipientType === 'identity'" class="mb-3">
        <label class="form-label" for="threema-recipient">{{ $t("threemaRecipient") }} {{ $t("threemaRecipientTypeIdentity") }} <small>({{ $t("threemaRecipientTypeIdentityFormat") }})</small></label>
        <input
            id="threema-recipient"
            v-model="$parent.notification.threemaRecipient"
            class="form-control"
            minlength="8"
            maxlength="8"
            pattern="[A-Z0-9]{8}"
            required
            type="text"
        >
    </div>
    <div v-if="$parent.notification.threemaRecipientType === 'phone'" class="mb-3">
        <label class="form-label" for="threema-recipient">{{ $t("threemaRecipient") }}  {{ $t("threemaRecipientTypePhone") }} <small>({{ $t("threemaRecipientTypePhoneFormat") }})</small></label>
        <input
            id="threema-recipient"
            v-model="$parent.notification.threemaRecipient"
            class="form-control"
            maxlength="15"
            pattern="\d{1,15}"
            required
            type="text"
        >
    </div>
    <div v-if="$parent.notification.threemaRecipientType === 'email'" class="mb-3">
        <label class="form-label" for="threema-recipient">{{ $t("threemaRecipient") }} {{ $t("threemaRecipientTypeEmail") }}</label>
        <input
            id="threema-recipient"
            v-model="$parent.notification.threemaRecipient"
            class="form-control"
            maxlength="254"
            required
            type="email"
        >
    </div>
    <div class="mb-3">
        <label class="form-label" for="threema-sender">{{ $t("threemaSenderIdentity") }} <small>({{ $t("threemaSenderIdentityFormat") }})</small></label>
        <input
            id="threema-sender"
            v-model="$parent.notification.threemaSenderIdentity"
            class="form-control"
            minlength="8"
            maxlength="8"
            pattern="^\*[A-Z0-9]{7}$"
            required
            type="text"
        >
    </div>
    <div class="mb-3">
        <label class="form-label" for="threema-secret">{{ $t("threemaApiAuthenticationSecret") }}</label>
        <HiddenInput
            id="threema-secret" v-model="$parent.notification.threemaSecret" :required="true"
            autocomplete="false"
        ></HiddenInput>
        <i18n-t class="form-text" keypath="wayToGetThreemaGateway" tag="div">
            <a href="https://threema.ch/en/gateway" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
        <i18n-t class="form-text" keypath="threemaBasicModeInfo" tag="div">
            <a href="https://gateway.threema.ch/en/developer/api" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
    </div>
</template>
<script lang="ts" setup>
import HiddenInput from "../HiddenInput.vue";
</script>
