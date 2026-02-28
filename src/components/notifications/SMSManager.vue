<template>
    <div class="mb-3">
        <label for="smsmanager-key" class="form-label">{{ $t("API Key") }}</label>
        <div class="form-text">
            {{ $t("SMSManager API Docs") }}
            <a href="https://smsmanager.cz/api/http#send" target="_blank">{{ $t("here") }}</a>
        </div>
        <input id="smsmanager-key" v-model="$parent.notification.smsmanagerApiKey" type="text" class="form-control" />
    </div>
    <div class="mb-3">
        <label for="smsmanager-numbers" class="form-label">{{ $t("Recipients") }}</label>
        <i18n-t tag="div" keypath="You can divide numbers with commas or semicolons" class="form-text">
            <template #comma>
                <code>,</code>
            </template>
            <template #semicolon>
                <code>;</code>
            </template>
        </i18n-t>
        <input id="smsmanager-numbers" v-model="$parent.notification.numbers" type="text" class="form-control" />
    </div>
    <div class="mb-3">
        <label for="smsmanager-messageType" class="form-label">{{ $t("Gateway Type") }}</label>
        <select id="smsmanager-messageType" v-model="$parent.notification.messageType" class="form-select">
            <option value="economy">{{ $t("Economy") }}</option>
            <option value="lowcost">{{ $t("Lowcost") }}</option>
            <option value="high" selected>{{ $t("High") }}</option>
        </select>
    </div>
    <div class="mb-3">
        <i18n-t tag="div" keypath="checkPriceAt" class="form-text">
            <template #service>SMSManager</template>
            <template #url>
                <a href="https://smsmanager.cz/rozesilani-sms/ceny/ceska-republika/" target="_blank">
                    {{ $t("here") }}
                </a>
            </template>
        </i18n-t>
    </div>
</template>
