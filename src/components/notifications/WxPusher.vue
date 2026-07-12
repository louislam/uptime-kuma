<template>
    <div class="mb-3">
        <label for="wxpusher-spt" class="form-label">WxPusher SPT</label>
        <HiddenInput
            id="wxpusher-spt"
            v-model="$parent.notification.wxpusherSPT"
            :required="true"
            autocomplete="new-password"
            placeholder="SPT_xxxxxxxxxxxx"
        ></HiddenInput>
        <div class="form-text">
            <i18n-t tag="p" keypath="wxPusherSptDescription">
                <template #download>
                    <a
                        href="https://wxpusher.zjiecode.com/download/?utm_source=uptime-kuma"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {{ $t("wxPusherDownloadApp") }}
                    </a>
                </template>
                <template #docs>
                    <a
                        href="https://wxpusher.zjiecode.com/docs/?utm_source=uptime-kuma#/?id=spt"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {{ $t("wxPusherDocs") }}
                    </a>
                </template>
            </i18n-t>
            <img
                src="https://wxpusher.zjiecode.com/api/qrcode/RwjGLMOPTYp35zSYQr0HxbCPrV9eU0wKVBXU1D5VVtya0cQXEJWPjqBdW3gKLifS.jpg"
                alt="WxPusher SPT QR code"
                style="width: 160px; height: 160px; margin-top: 8px; display: block"
            />
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
