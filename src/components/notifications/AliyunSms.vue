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
            <input id="enableCustomTemplate" v-model="$parent.notification.enableCustomTemplate" class="form-check-input" type="checkbox">
            <label for="enableCustomTemplate" class="form-check-label">{{ $t("Enable Custom Template") }}</label>
        </div>

        <div v-if="$parent.notification.enableCustomTemplate" class="mb-3">
            <label for="customName" class="form-label">{{ $t("Custom Name") }}</label>
            <input id="customName" v-model="$parent.notification.customName" type="text" class="form-control">
        </div>

        <div v-if="$parent.notification.enableCustomTemplate" class="mb-3">
            <label for="statusTemplate" class="form-label">{{ $t("${status} Template") }}</label>
            <textarea id="statusTemplate" v-model="$parent.notification.statusTemplate" class="form-control" rows="2" placeholder="{% if status == 'up' %}[在线]{% else %}[故障]{% endif %}"></textarea>

            <label for="msgTemplate" class="form-label">{{ $t("${msg} Template") }}</label>
            <textarea id="msgTemplate" v-model="$parent.notification.msgTemplate" class="form-control" rows="2" placeholder="{% if status == 'up' %}请查看钉钉{% else %}请及时处理{% endif %}"></textarea>
        </div>

        <div class="form-text">
            <p>{{ $t("Sms template must contain parameters: ") }}<br> <code>${name} ${time} ${status} ${msg}</code></p>
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://help.aliyun.com/document_detail/101414.html" target="_blank">https://help.aliyun.com/document_detail/101414.html</a>
            </i18n-t>
        </div>
    </div>
</template>
