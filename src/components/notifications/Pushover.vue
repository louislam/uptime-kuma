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
            <option value="pushover">{{ $t("pushoversounds pushover") }}</option>
            <option value="bike">{{ $t("pushoversounds bike") }}</option>
            <option value="bugle">{{ $t("pushoversounds bugle") }}</option>
            <option value="cashregister">{{ $t("pushoversounds cashregister") }}</option>
            <option value="classical">{{ $t("pushoversounds classical") }}</option>
            <option value="cosmic">{{ $t("pushoversounds cosmic") }}</option>
            <option value="falling">{{ $t("pushoversounds falling") }}</option>
            <option value="gamelan">{{ $t("pushoversounds gamelan") }}</option>
            <option value="incoming">{{ $t("pushoversounds incoming") }}</option>
            <option value="intermission">{{ $t("pushoversounds intermission") }}</option>
            <option value="magic">{{ $t("pushoversounds magic") }}</option>
            <option value="mechanical">{{ $t("pushoversounds mechanical") }}</option>
            <option value="pianobar">{{ $t("pushoversounds pianobar") }}</option>
            <option value="siren">{{ $t("pushoversounds siren") }}</option>
            <option value="spacealarm">{{ $t("pushoversounds spacealarm") }}</option>
            <option value="tugboat">{{ $t("pushoversounds tugboat") }}</option>
            <option value="alien">{{ $t("pushoversounds alien") }}</option>
            <option value="climb">{{ $t("pushoversounds climb") }}</option>
            <option value="persistent">{{ $t("pushoversounds persistent") }}</option>
            <option value="echo">{{ $t("pushoversounds echo") }}</option>
            <option value="updown">{{ $t("pushoversounds updown") }}</option>
            <option value="vibrate">{{ $t("pushoversounds vibrate") }}</option>
            <option value="none">{{ $t("pushoversounds none") }}</option>
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
