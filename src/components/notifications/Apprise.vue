<template>
    <div class="mb-3">
        <label for="apprise-url" class="form-label">{{ $t("Apprise URL") }}</label>
        <input id="apprise-url" v-model="$parent.notification.appriseURL" type="text" class="form-control" required>
        <div class="form-text">
            <p>{{ $t("Example:", ["twilio://AccountSid:AuthToken@FromPhoneNo"]) }}</p>
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://github.com/caronc/apprise/wiki#notification-services" target="_blank">https://github.com/caronc/apprise/wiki#notification-services</a>
            </i18n-t>
        </div>

        <label for="title" class="form-label">{{ $t("Title") }}</label>
        <input id="title" v-model="$parent.notification.title" type="text" class="form-control">
    </div>
    <div class="mb-3">
        <i18n-t tag="p" keypath="Status:">
            <span v-if="appriseInstalled" class="text-primary">{{ $t("appriseInstalled") }}</span>
            <i18n-t v-else tag="span" keypath="appriseNotInstalled" class="text-danger">
                <a href="https://github.com/caronc/apprise" target="_blank">{{ $t("Read more") }}</a>
            </i18n-t>
        </i18n-t>
    </div>
</template>

<script>
export default {
    data() {
        return {
            appriseInstalled: false
        };
    },
    mounted() {
        this.$root.getSocket().emit("checkApprise", (installed) => {
            this.appriseInstalled = installed;
        });
    },
};
</script>
