<template>
    <div class="mb-3">
        <label for="smsplanet-api-token" class="form-label">{{ $t('smsplanetApiToken') }}</label>
        <HiddenInput id="smsplanet-api-token" v-model="$parent.notification.smsplanetApiToken" :required="true"></HiddenInput>
        <i18n-t tag="div" keypath="smsplanetApiDocs" class="form-text">
            <template #the_smsplanet_documentation>
                <a
                    href="https://smsplanet.pl/doc/slate/index.html#introduction"
                    target="_blank"
                >{{ $t("the smsplanet documentation") }}</a>
            </template>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="smsplanet-phone-numbers" class="form-label">{{ $t("Phone numbers") }}</label>
        <textarea
            id="smsplanet-phone-numbers"
            v-model="$parent.notification.smsplanetPhoneNumbers"
            class="form-control"
            :placeholder="smsplanetPhoneNumbers"
            required
        ></textarea>
    </div>
    <div class="mb-3">
        <label for="smsplanet-sender-name" class="form-label">{{ $t("Sender name") }}</label>
        <input id="smsplanet-sender-name" v-model="$parent.notification.smsplanetSenderName" type="text" minlength="3" maxlength="11" class="form-control">
        <div class="form-text">{{ $t("smsplanetNeedToApproveName") }}</div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    computed: {
        smsplanetPhoneNumbers() {
            return this.$t("Example:", [
                "+48123456789,+48111222333",
            ]);
        }
    }
};
</script>
