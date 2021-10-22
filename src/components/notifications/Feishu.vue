<template>
    <div class="mb-3">
        <label for="Feishu-WebHookUrl" class="form-label">{{ $t("Feishu WebHookUrl") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="Feishu-WebHookUrl" v-model="$parent.notification.feishuWebHookUrl" type="text" class="form-control" required>
        <div class="form-text">
            <p><span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}</p>
        </div>
        <i18n-t tag="div" keypath="wayToGetTeamsURL" class="form-text">
            <a
                href="https://www.feishu.cn/hc/zh-CN/articles/360024984973"
                target="_blank"
            >{{ $t("here") }}</a>
        </i18n-t>
    </div>
</template>
