<template>
    <div class="mb-3">
        <label for="line-channel-access-token" class="form-label">Channel access token</label>
        <HiddenInput id="line-channel-access-token" v-model="$parent.notification.lineChannelAccessToken" :required="true" autocomplete="one-time-code"></HiddenInput>
    </div>
    <div class="form-text">
        Line Developers Console - <b>Basic Settings</b>
    </div>
    <div class="mb-3" style="margin-top: 12px;">
        <label for="line-user-id" class="form-label">User ID</label>
        <input id="line-user-id" v-model="$parent.notification.lineUserID" type="text" class="form-control" required>
    </div>
    <div class="form-text">
        Line Developers Console - <b>Messaging API</b>
    </div>
    <div class="form-text" style="margin-top: 8px;">
        First access the <a href="https://developers.line.biz/console/" target="_blank">Line Developers Console</a>, create a provider and channel (Messaging API), then you can get the channel access token and user id from the above mentioned menu items.
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
