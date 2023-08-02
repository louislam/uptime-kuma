<template>
    <div class="mb-3">
        <label for="gorush-device-token" class="form-label">{{ $t("Device Token") }}</label><span style="color: red;"><sup>*</sup></span>
        <input id="gorush-device-token" v-model="$parent.notification.gorushDeviceToken" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="gorush-server-url" class="form-label">{{ $t("Server URL") }}</label><span style="color: red;"><sup>*</sup></span>
        <input id="gorush-server-url" v-model="$parent.notification.gorushServerURL" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="gorush-platform" class="form-label">{{ $t("Platform") }}</label><span style="color: red;"><sup>*</sup></span>
        <select id="gorush-platform" v-model="$parent.notification.gorushPlatform" class="form-select">
            <option value="ios">iOS</option>
            <option value="android">Android</option>
            <option value="huawei">{{ $t("Huawei") }}</option>
        </select>
    </div>

    <div class="mb-3">
        <label for="gorush-title" class="form-label">{{ $t("Title") }}</label>
        <input id="gorush-title" v-model="$parent.notification.gorushTitle" type="text" class="form-control">
    </div>

    <div class="mb-3">
        <label for="gorush-priority" class="form-label">{{ $t("Priority") }}</label>
        <select id="gorush-priority" v-model="$parent.notification.gorushPriority" class="form-select">
            <option value="normal">{{ $t("Normal") }}</option>
            <option value="high">{{ $t("High") }}</option>
        </select>
    </div>

    <div class="mb-3">
        <label for="gorush-retry" class="form-label">{{ $t("Retry") }}</label>
        <input id="gorush-retry" v-model="$parent.notification.gorushRetry" type="number" class="form-control">
    </div>

    <div class="mb-3">
        <label for="gorush-topic" class="form-label">{{ $t("Topic") }}</label>
        <input id="gorush-topic" v-model="$parent.notification.gorushTopic" type="text" class="form-control">
    </div>

    <div class="form-text">
        <span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}
    </div>
</template>
