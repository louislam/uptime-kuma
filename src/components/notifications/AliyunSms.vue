<script setup lang="ts">
</script>
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
        <br>
        <div class="form-check form-switch">
            <label class="form-check-label">{{ $t("OptionalParameters") }} &nbsp;&nbsp;</label>
            <input id="optionalParameters" v-model="$parent.notification.optionalParameters" class="form-check-input" type="checkbox">
        </div>
        <div data-v-1e7297ef="" class="form-text">{{ $t("If not enabled, optional variables will not be sent (due to carrier restrictions, the content contained in variables may be rejected, therefore an option is provided to disable certain variables).") }} </div>
        <br>
        <div class="form-text">
            <p>{{ $t("Sms template must contain parameters: ") }}<br> <code>${name} ${time} ${status}</code><br><br> {{ $t("following parameters are optional: ") }}<br> <code>${msg}</code></p>
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://help.aliyun.com/document_detail/101414.html" target="_blank">https://help.aliyun.com/document_detail/101414.html</a>
            </i18n-t>
        </div>
    </div>
</template>
