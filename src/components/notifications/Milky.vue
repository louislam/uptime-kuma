<template>
    <div class="mb-3">
        <div class="mb-3">
            <label for="milky-http-addr" class="form-label">
                {{ $t("milkyHttpAddress") }}
                <span style="color: red"><sup>*</sup></span>
            </label>
            <input id="HttpUrl" v-model="$parent.notification.httpAddr" type="text" class="form-control" required />
        </div>
        <div class="mb-3">
            <label for="milky-access-token" class="form-label">
                AccessToken
                <span style="color: red"><sup>*</sup></span>
            </label>
            <input id="HttpUrl" v-model="$parent.notification.accessToken" type="text" class="form-control" required />
            <div class="form-text">
                <p>{{ $t("milkySafetyTips") }}</p>
            </div>
        </div>

        <div class="mb-3">
            <label for="milky-msg-type" class="form-label">{{ $t("milkyMessageType") }}</label>
            <select id="milky-msg-type" v-model="$parent.notification.msgType" class="form-select">
                <option value="group">{{ $t("milkyGroupMessage") }}</option>
                <option value="private">{{ $t("milkyPrivateMessage") }}</option>
            </select>
        </div>

        <div class="mb-3">
            <label for="milky-reciever-id" class="form-label">
                {{ $t("milkyUserOrGroupId") }}
                <span style="color: red"><sup>*</sup></span>
            </label>
            <input id="secretKey" v-model="$parent.notification.recieverId" type="text" class="form-control" required />
        </div>

        <div class="form-text">
            <i18n-t tag="p" keypath="For more:">
                <a href="https://milky.ntqqrev.org/" target="_blank">https://milky.ntqqrev.org/</a>
            </i18n-t>
        </div>
    </div>
</template>
