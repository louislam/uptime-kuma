<template>
    <div class="mb-3">
        <label for="pushover-user" class="form-label">{{ $t("User Key") }}<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="pushover-user" v-model="$parent.notification.pushoveruserkey" :required="true" autocomplete="one-time-code"></HiddenInput>
        <label for="pushover-app-token" class="form-label">{{ $t("Application Token") }}<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="pushover-app-token" v-model="$parent.notification.pushoverapptoken" :required="true" autocomplete="one-time-code"></HiddenInput>
        <label for="pushover-device" class="form-label">{{ $t("Device") }}</label>
        <input id="pushover-device" v-model="$parent.notification.pushoverdevice" type="text" class="form-control">
        <label for="pushover-device" class="form-label">{{ $t("Message Title") }}</label>
        <input id="pushover-title" v-model="$parent.notification.pushovertitle" type="text" class="form-control">
        <label for="pushover-priority" class="form-label">{{ $t("Priority") }}</label>
        <select id="pushover-priority" v-model="$parent.notification.pushoverpriority" class="form-select">
            <option>-2</option>
            <option>-1</option>
            <option>0</option>
            <option>1</option>
            <option>2</option>
        </select>
        <label for="pushover-sound" class="form-label">{{ $t("Notification Sound") }}</label>
        <select id="pushover-sound" v-model="$parent.notification.pushoversounds" class="form-select">
            <option>{{ $t("pushoversounds pushover") }}</option>
            <option>{{ $t("pushoversounds bike") }}</option>
            <option>{{ $t("pushoversounds bugle") }}</option>
            <option>{{ $t("pushoversounds cashregister") }}</option>
            <option>{{ $t("pushoversounds classical") }}</option>
            <option>{{ $t("pushoversounds cosmic") }}</option>
            <option>{{ $t("pushoversounds falling") }}</option>
            <option>{{ $t("pushoversounds gamelan") }}</option>
            <option>{{ $t("pushoversounds incoming") }}</option>
            <option>{{ $t("pushoversounds intermission") }}</option>
            <option>{{ $t("pushoversounds magic") }}</option>
            <option>{{ $t("pushoversounds mechanical") }}</option>
            <option>{{ $t("pushoversounds pianobar") }}</option>
            <option>{{ $t("pushoversounds siren") }}</option>
            <option>{{ $t("pushoversounds spacealarm") }}</option>
            <option>{{ $t("pushoversounds tugboat") }}</option>
            <option>{{ $t("pushoversounds alien") }}</option>
            <option>{{ $t("pushoversounds climb") }}</option>
            <option>{{ $t("pushoversounds persistent") }}</option>
            <option>{{ $t("pushoversounds echo") }}</option>
            <option>{{ $t("pushoversounds updown") }}</option>
            <option>{{ $t("pushoversounds vibrate") }}</option>
            <option>{{ $t("pushoversounds none") }}</option>
        </select>
        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}
            <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
                <a href="https://pushover.net/api" target="_blank">https://pushover.net/api</a>
            </i18n-t>
            <p style="margin-top: 8px;">
                {{ $t("pushoverDesc1") }}
            </p>
            <p style="margin-top: 8px;">
                {{ $t("pushoverDesc2") }}
            </p>
        </div>
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
