<template>
    <div class="mb-3">
        <label for="vk-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <HiddenInput
            id="vk-access-token"
            v-model="$parent.notification.vkAccessToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="vk-api-version" class="form-label">{{ $t("API Version") }}</label>
        <input
            id="vk-api-version"
            v-model="$parent.notification.vkApiVersion"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">
            {{ $t("vkApiVersionDescription") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="vk-peer-id" class="form-label">{{ $t("Peer ID") }}</label>
        <input id="vk-peer-id" v-model="$parent.notification.vkPeerId" type="text" class="form-control" required />
        <div class="form-text">
            {{ $t("vkPeerIdDescription") }}
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.vkDontParseLinks" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("vkDontParseLinks") }}</label>
        </div>
        <div class="form-text">
            {{ $t("vkDontParseLinksDescription") }}
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        this.$parent.notification.vkApiVersion ||= "5.199";
        this.$parent.notification.vkDontParseLinks ||= false;
    },
};
</script>
