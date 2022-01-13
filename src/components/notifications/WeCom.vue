<template>
    <div class="mb-3">
        <label for="WeCom Bot Key" class="form-label">{{ $t("WeCom Bot Key") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="WeCom Bot Key" v-model="$parent.notification.weComBotKey" type="text" class="form-control" required>
        <div class="form-text">
            <p><span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}</p>
        </div>
        <i18n-t tag="p" keypath="Read more:">
            <a href="https://work.weixin.qq.com/api/doc/90000/90136/91770" target="_blank">https://work.weixin.qq.com/api/doc/90000/90136/91770</a>
        </i18n-t>
    </div>
</template>
