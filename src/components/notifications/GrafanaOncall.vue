<template>
    <div class="mb-3">
        <label for="grafanaoncallURL" class="form-label">{{ $t("Grafana Oncall URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="grafanaoncallURL" v-model="$parent.notification.grafanaoncallURL" type="text" class="form-control" required>
    </div>
</template>

