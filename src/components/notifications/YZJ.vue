<template>
    <div class="mb-3">
        <label for="yzjWebHookUrl" class="form-label">{{ $t("YZJ Webhook URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="yzjWebHookUrl" v-model="$parent.notification.yzjWebHookUrl" type="text" class="form-control" required />
        <label for="yzjType" class="form-label">{{ $t("YZJ Robot Type") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="yzjType" v-model="$parent.notification.yzjType" type="text" class="form-control" required />
        <label for="yzjToken" class="form-label">{{ $t("YZJ Robot Token") }}<span style="color: red;"><sup>*</sup></span></label>
        <hidden-input id="yzjToken" v-model="$parent.notification.yzjToken" type="text" class="form-control" required />
        <i18n-t class="form-text" keypath="wayToGetTeamsURL">
            <a href="https://www.yunzhijia.com/opendocs/docs.html#/tutorial/index/robot" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
    </div>
</template>
<script setup lang="ts">
import HiddenInput from "../HiddenInput.vue";
</script>
