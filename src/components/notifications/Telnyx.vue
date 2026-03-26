<template>
    <div class="mb-3">
        <label for="telnyx-api-key" class="form-label">{{ $t("telnyxApiKey") }}</label>
        <input
            id="telnyx-api-key"
            v-model="$parent.notification.telnyxApiKey"
            type="password"
            class="form-control"
            required
        />
        <div class="form-text">{{ $t("telnyxApiKeyHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="telnyx-phone-number" class="form-label">{{ $t("telnyxPhoneNumber") }}</label>
        <input
            id="telnyx-phone-number"
            v-model="$parent.notification.telnyxPhoneNumber"
            type="text"
            class="form-control"
            placeholder="+15551234567"
            required
        />
    </div>

    <div class="mb-3">
        <label for="telnyx-to-number" class="form-label">{{ $t("telnyxToNumber") }}</label>
        <input
            id="telnyx-to-number"
            v-model="$parent.notification.telnyxToNumber"
            type="text"
            class="form-control"
            placeholder="+15559876543"
            required
        />
    </div>

    <div class="mb-3">
        <label for="telnyx-messaging-profile-id" class="form-label">{{ $t("telnyxMessagingProfileId") }}</label>
        <input
            id="telnyx-messaging-profile-id"
            v-model="$parent.notification.telnyxMessagingProfileId"
            type="text"
            class="form-control"
        />
        <div class="form-text">{{ $t("telnyxMessagingProfileIdHelptext") }}</div>
    </div>

    <div class="mb-3">
        <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px">
            <a href="https://developers.telnyx.com/docs/messaging/messages/send-sms-mms" target="_blank">
                https://developers.telnyx.com/docs/messaging
            </a>
        </i18n-t>
    </div>
</template>
