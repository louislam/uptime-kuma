<template>
    <div class="form-text">
        <p>
            You find the API-Username and API-password at <a href="https://46elks.com/account">https://46elks.com/account</a>
        </p>
    </div>
    <div class="mb-3">
        <label for="ElksUsername" class="form-label">{{ $t("elksUsername") }}</label>
        <input id="ElksUsername" v-model="$parent.notification.elksUsername" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="ElksPassword" class="form-label">{{ $t("elksPassword") }}</label>
        <input id="ElksPassword" v-model="$parent.notification.elksAuthToken" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="Elks-from-number" class="form-label">{{ $t("From Number") }}</label>
        <input id="Elks-from-number" v-model="$parent.notification.elksFromNumber" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="Elks-to-number" class="form-label">{{ $t("To Number") }}</label>
        <input id="Elks-to-number" v-model="$parent.notification.elksToNumber" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
            <a href="https://46elks.com/docs/send-sms" target="_blank">https://46elks.com/docs/send-sms</a>
        </i18n-t>
    </div>
</template>
