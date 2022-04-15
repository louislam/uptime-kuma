<template>
    <div class="mb-3">
        <div class="mb-3">
            <label for="onebot-http-addr" class="form-label">{{ $t("onebotHttpAddress") }}<span style="color: red;"><sup>*</sup></span></label>
            <input id="HttpUrl" v-model="$parent.notification.httpAddr" type="text" class="form-control" required>
        </div>
        <div class="mb-3">
            <label for="onebot-access-token" class="form-label">AccessToken<span style="color: red;"><sup>*</sup></span></label>
            <input id="HttpUrl" v-model="$parent.notification.accessToken" type="text" class="form-control" required>
            <div class="form-text">
                <p>{{ $t("onebotSafetyTips") }}</p>
            </div>
        </div>

        <div class="mb-3">
            <label for="onebot-msg-type" class="form-label">{{ $t("onebotMessageType") }}</label>
            <select id="onebot-msg-type" v-model="$parent.notification.msgType" class="form-select">
                <option value="group">{{ $t("onebotGroupMessage") }}</option>
                <option value="private">{{ $t("onebotPrivateMessage") }}</option>
            </select>
        </div>

        <div class="mb-3">
            <label for="onebot-reciever-id" class="form-label">{{ $t("onebotUserOrGroupId") }}<span style="color: red;"><sup>*</sup></span></label>
            <input id="secretKey" v-model="$parent.notification.recieverId" type="text" class="form-control" required>
        </div>

        <div class="form-text">
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://github.com/botuniverse/onebot-11" target="_blank">https://github.com/botuniverse/onebot-11</a>
            </i18n-t>
        </div>
    </div>
</template>
