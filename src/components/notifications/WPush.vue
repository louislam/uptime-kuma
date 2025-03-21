<template>
    <div class="mb-3">
        <label for="wpush-apikey" class="form-label">WPush {{ $t("API Key") }}</label>
        <HiddenInput id="wpush-apikey" v-model="$parent.notification.wpushAPIkey" :required="true" autocomplete="new-password" placeholder="WPushxxxxx"></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="wpush-channel" class="form-label">发送通道</label>
        <select id="wpush-channel" v-model="$parent.notification.wpushChannel" class="form-select" required>
            <option value="wechat">微信</option>
            <option value="sms">短信</option>
            <option value="mail">邮件</option>
            <option value="feishu">飞书</option>
            <option value="dingtalk">钉钉</option>
            <option value="wechat_work">企业微信</option>
        </select>
    </div>

    <i18n-t tag="p" keypath="More info on:">
        <a href="https://wpush.cn/" rel="noopener noreferrer" target="_blank">https://wpush.cn/</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
export default {
    components: {
        HiddenInput,
    },
};
</script>
