<template>
    <div class="mb-3">
        <label for="pushover-user" class="form-label">User Key<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="pushover-user" v-model="$parent.notification.pushoveruserkey" :required="true" autocomplete="one-time-code"></HiddenInput>
        <label for="pushover-app-token" class="form-label">Application Token<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="pushover-app-token" v-model="$parent.notification.pushoverapptoken" :required="true" autocomplete="one-time-code"></HiddenInput>
        <label for="pushover-device" class="form-label">Device</label>
        <input id="pushover-device" v-model="$parent.notification.pushoverdevice" type="text" class="form-control">
        <label for="pushover-device" class="form-label">Message Title</label>
        <input id="pushover-title" v-model="$parent.notification.pushovertitle" type="text" class="form-control">
        <label for="pushover-priority" class="form-label">Priority</label>
        <select id="pushover-priority" v-model="$parent.notification.pushoverpriority" class="form-select">
            <option>-2</option>
            <option>-1</option>
            <option>0</option>
            <option>1</option>
            <option>2</option>
        </select>
        <label for="pushover-sound" class="form-label">Notification Sound</label>
        <select id="pushover-sound" v-model="$parent.notification.pushoversounds" class="form-select">
            <option>pushover</option>
            <option>bike</option>
            <option>bugle</option>
            <option>cashregister</option>
            <option>classical</option>
            <option>cosmic</option>
            <option>falling</option>
            <option>gamelan</option>
            <option>incoming</option>
            <option>intermission</option>
            <option>mechanical</option>
            <option>pianobar</option>
            <option>siren</option>
            <option>spacealarm</option>
            <option>tugboat</option>
            <option>alien</option>
            <option>climb</option>
            <option>persistent</option>
            <option>echo</option>
            <option>updown</option>
            <option>vibrate</option>
            <option>none</option>
        </select>
        <div class="form-text">
            <span style="color: red;"><sup>*</sup></span>Required
            <p style="margin-top: 8px;">
                More info on: <a href="https://pushover.net/api" target="_blank">https://pushover.net/api</a>
            </p>
            <p style="margin-top: 8px;">
                Emergency priority (2) has default 30 second timeout between retries and will expire after 1 hour.
            </p>
            <p style="margin-top: 8px;">
                If you want to send notifications to different devices, fill out Device field.
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
}
</script>
