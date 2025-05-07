<template>
    <div class="mb-3">
        <label for="pushover-user" class="form-label">{{ $t("User Key") }}<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="pushover-user" v-model="$parent.notification.pushoveruserkey" :required="true" autocomplete="new-password"></HiddenInput>
        <label for="pushover-app-token" class="form-label">{{ $t("Application Token") }}<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="pushover-app-token" v-model="$parent.notification.pushoverapptoken" :required="true" autocomplete="new-password"></HiddenInput>
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

        <label for="pushover-sound-down" class="form-label">{{ $t("Notification Sound") }} - Up</label>
        <select id="pushover-sound-down" v-model="$parent.notification.pushoversounds" class="form-select">
            <option v-for="sound in soundOptions" :key="sound" :value="sound">
                {{ $t(`pushoversounds ${sound}`) }}
            </option>
        </select>

        <label for="pushover-sound-up" class="form-label">{{ $t("Notification Sound") }} - Down</label>
        <select id="pushover-sound-up" v-model="$parent.notification.pushoversounds_up" class="form-select">
            <option v-for="sound in soundOptions" :key="sound" :value="sound">
                {{ $t(`pushoversounds ${sound}`) }}
            </option>
        </select>

        <label for="pushover-ttl" class="form-label">{{ $t("pushoverMessageTtl") }}</label>
        <input id="pushover-ttl" v-model="$parent.notification.pushoverttl" type="number" min="0" step="1" class="form-control">

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
    data() {
        return {
            soundOptions: [
                "pushover",
                "bike",
                "bugle",
                "cashregister",
                "classical",
                "cosmic",
                "falling",
                "gamelan",
                "incoming",
                "intermission",
                "magic",
                "mechanical",
                "pianobar",
                "siren",
                "spacealarm",
                "tugboat",
                "alien",
                "climb",
                "persistent",
                "echo",
                "updown",
                "vibrate",
                "none",
            ],
        };
    },
};
</script>
