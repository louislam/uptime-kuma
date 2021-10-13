<template>
    <div class="mb-3">
        <label for="lunasea-device" class="form-label">{{ $t("LunaSea Device ID") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="lunasea-device" v-model="$parent.notification.lunaseaDevice" type="text" class="form-control" required>
        <div class="form-text">
            <p><span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}</p>
        </div>
    </div>
</template>
