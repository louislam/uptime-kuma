<template>
    <div class="mb-3">
        <label for="accessKeyId" class="form-label">{{ $t("AccessKeyId") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="accessKeyId" v-model="$parent.notification.accessKeyId" type="text" class="form-control" required>

        <label for="secretAccessKey" class="form-label">{{ $t("SecretAccessKey") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="secretAccessKey" v-model="$parent.notification.secretAccessKey" type="text" class="form-control" required>

        <label for="phonenumber" class="form-label">{{ $t("PhoneNumbers") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="phonenumber" v-model="$parent.notification.phonenumber" type="text" class="form-control" required>

        <label for="templateCode" class="form-label">{{ $t("TemplateCode") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="templateCode" v-model="$parent.notification.templateCode" type="text" class="form-control" required>

        <label for="signName" class="form-label">{{ $t("SignName") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="signName" v-model="$parent.notification.signName" type="text" class="form-control" required>

        <div class="form-check form-switch mb-3">
            <input id="enableCustomVariables" v-model="$parent.notification.enableCustomVariables" class="form-check-input" type="checkbox">
            <label for="enableCustomVariables" class="form-check-label">{{ $t("Enable Custom Variables") }}</label>
        </div>

        <div v-if="$parent.notification.enableCustomVariables" class="mb-3">
            <label for="customName" class="form-label">{{ $t("Custom Name") }}</label>
            <input id="customName" v-model="$parent.notification.customName" type="text" class="form-control">

            <label for="customMsg" class="form-label">{{ $t("Custom Message") }}</label>
            <input id="customMsg" v-model="$parent.notification.customMsg" type="text" class="form-control">

            <label for="customUpText" class="form-label">{{ $t("Custom UP Text") }}</label>
            <input id="customUpText" v-model="$parent.notification.customUpText" type="text" class="form-control">

            <label for="customDownText" class="form-label">{{ $t("Custom DOWN Text") }}</label>
            <input id="customDownText" v-model="$parent.notification.customDownText" type="text" class="form-control">
        </div>

        <div class="form-text">
            <p>{{ $t("Sms template must contain parameters: ") }}<br> <code>${name} ${time} ${status} ${msg}</code></p>
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://help.aliyun.com/document_detail/101414.html" target="_blank">https://help.aliyun.com/document_detail/101414.html</a>
            </i18n-t>
        </div>
    </div>
</template>
