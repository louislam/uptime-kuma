<template>
    <div class="mb-3">
        <label for="lunasea-notification-type" class="form-label">{{ $t("Device ID or User ID") }}<span style="color: red;"><sup>*</sup></span></label>
        <div class="form-text">
            <p>
                <select id="lunasea-notification-type" v-model="$parent.notification.lunaseaNotificationType" class="form-select" required>
                    <option value="device">Device</option>
                    <option value="user">User</option>
                </select>
            </p>
        </div>
        <label for="lunasea-device" class="form-label">{{ $t("LunaSea ID") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="lunasea-device" v-model="$parent.notification.lunaseaDevice" type="text" class="form-control" required>
        <div class="form-text">
            <p><span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}</p>
        </div>
    </div>
</template>
