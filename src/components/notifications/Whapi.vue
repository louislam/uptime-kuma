<template>
    <div class="mb-3">
        <label for="whapi-api-url" class="form-label">{{ $t("API URL") }}</label>
        <input id="whapi-api-url" v-model="$parent.notification.whapiApiUrl" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="whapi-auth-token" class="form-label">{{ $t("Token") }}</label>
        <input id="whapi-auth-token" v-model="$parent.notification.whapiAuthToken" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="whapi-to-number" class="form-label">{{ $t("Phone number") }}</label>
        <input id="whapi-to-number" v-model="$parent.notification.whapiToNumber" type="text" pattern="^[\d-]{10,31}$" class="form-control" required>
        <i18n-t tag="div" keypath="wayToWriteWhapiPhoneNumber" class="form-text"></i18n-t>
    </div>

    <div class="mb-3">
        <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
            <a href="https://whapi.cloud/" target="_blank">https://whapi.cloud/</a>
        </i18n-t>
    </div>
</template>
