<template>
    <div class="mb-3">
        <label for="apprise-url" class="form-label">{{ $t("Apprise URL") }}</label>
        <input id="apprise-url" v-model="$parent.notification.appriseURL" type="text" class="form-control" required>
        <div class="form-text">
            <p>{{ $t("Example:", ["twilio://AccountSid:AuthToken@FromPhoneNo"]) }}</p>
            <i18n-t keypath="Read more:" tag="p">
                <a href="https://github.com/caronc/apprise/wiki#notification-services" target="_blank">https://github.com/caronc/apprise/wiki#notification-services</a>
            </i18n-t>
        </div>
    </div>
    <div class="mb-3">
        <i18n-t keypath="Status:" tag="p">
            <span v-if="appriseInstalled" class="text-primary">{{ $t("Apprise is installed.") }}</span>
            <span v-else class="text-danger">{{ $t("Apprise is not installed.") }}<a href="https://github.com/caronc/apprise" target="_blank">{{ $t("Read more") }}</a></span>
        </i18n-t>
    </div>
</template>

<script>
export default {
    data() {
        return {
            appriseInstalled: false
        }
    },
    mounted() {
        this.$root.getSocket().emit("checkApprise", (installed) => {
            this.appriseInstalled = installed;
        })
    },
}
</script>
