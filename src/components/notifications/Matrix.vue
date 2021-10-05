<template>
    <div class="mb-3">
        <label for="homeserver-url" class="form-label">Homeserver URL (with http(s):// and optionally port)</label>
        <input id="homeserver-url" v-model="$parent.notification.homeserverUrl" type="text" class="form-control" :required="true">
        <label for="internal-room-id" class="form-label">Internal Room Id</label>
        <input id="internal-room-id" v-model="$parent.notification.internalRoomId" type="text" class="form-control" required="true">
        <label for="access-token" class="form-label">Access Token</label>
        <HiddenInput id="access-token" v-model="$parent.notification.accessToken" :required="true" autocomplete="one-time-code" :maxlength="500"></HiddenInput>
    </div>

    <p style="margin-top: 8px;">
        You can find the internal room ID by looking in the advanced section if your Matrix client. It should look like !QMdRCpUIfLwsfjxye6:home.server.<br/>
        It is highly recommended you create a new user and do not use your Matrix user's access token as it will allow full access to the matrix user. You can get the access token by running curl -XPOST -d '{"type":"m.login.password", "identifier": {"user":"botusername", "type": "m.id.user"}, "password":"passwordforuser"}' "https://home.server.url/_matrix/client/r0/login".
    </p>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
}
</script>
