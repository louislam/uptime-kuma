<template>
    <div class="mb-3">
        <label for="apprise-url" class="form-label">Apprise URL</label>
        <input id="apprise-url" v-model="$parent.notification.appriseURL" type="text" class="form-control" required>
        <div class="form-text">
            <p>Example: twilio://AccountSid:AuthToken@FromPhoneNo</p>
            <p>
                Read more: <a href="https://github.com/caronc/apprise/wiki#notification-services" target="_blank">https://github.com/caronc/apprise/wiki#notification-services</a>
            </p>
        </div>
    </div>
    <div class="mb-3">
        <p>
            Status:
            <span v-if="appriseInstalled" class="text-primary">Apprise is installed</span>
            <span v-else class="text-danger">Apprise is not installed. <a href="https://github.com/caronc/apprise" target="_blank">Read more</a></span>
        </p>
    </div>
</template>

<script>
export default {
    data() {
        return {
            name: "apprise",
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
