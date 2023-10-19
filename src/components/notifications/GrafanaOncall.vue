<template>
    <div class="mb-3">
        <label for="GrafanaOncallURL" class="form-label">{{ $t("GrafanaOncallURL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="GrafanaOncallURL" v-model="$parent.notification.GrafanaOncallURL" type="text" class="form-control" required>
    </div>
</template>

