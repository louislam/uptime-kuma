<template>
    <div class="mb-3">
        <label for="yzjWebHookUrl" class="form-label">{{ $t("YZJ Webhook URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="yzjWebHookUrl" v-model="$parent.notification.yzjWebHookUrl" type="url" class="form-control" required />
        <i18n-t class="form-text" keypath="wayToGetTeamsURL">
            <a href="https://www.yunzhijia.com/opendocs/docs.html#/tutorial/index/robot" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="yzjType" class="form-label">{{ $t("YZJ Robot Type") }}<span style="color: red;"><sup>*</sup></span></label>
        <select id="yzjType" v-model="$parent.notification.yzjType" class="form-control" required>
            <option :value="0">{{ $t("YZJ General Robot") }}</option>
        </select>
    </div>
    <div class="mb-3">
        <label for="yzjToken" class="form-label">{{ $t("YZJ Robot Token") }}<span style="color: red;"><sup>*</sup></span></label>
        <hidden-input id="yzjToken" v-model="$parent.notification.yzjToken" type="text" class="form-control" required />
        <i18n-t class="form-text" keypath="wayToGetLineNotifyToken">
            <a href="https://www.yunzhijia.com/opendocs/docs.html#/server-api/im/index?id=%e6%8e%a5%e5%8f%a3%e5%9c%b0%e5%9d%80%e5%92%8c%e6%8e%88%e6%9d%83%e7%a0%81" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
    </div>
</template>
<script setup lang="ts">
import HiddenInput from "../HiddenInput.vue";
</script>
