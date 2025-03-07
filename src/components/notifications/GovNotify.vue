<template>
    <div class="mb-3">
        <label class="form-label">GOV Notify API Key</label>
        <div class="input-group">
            <input
                v-if="!showApiKey"
                type="text"
                class="form-control"
                value="************"
                disabled
            />
            <input
                v-else
                v-model="newApiKey"
                type="text"
                class="form-control"
                placeholder="Enter new API key"
            />
            <button class="btn btn-outline-secondary" type="button" @click="toggleApiKey">
                {{ showApiKey ? "Cancel" : "Change" }}
            </button>
        </div>
    </div>
    <div class="mb-3">
        <label class="form-label">Email Recipients (comma-separated)</label>
        <input
            v-model="$parent.notification.emailRecipients"
            type="text"
            class="form-control"
        />
    </div>
    <div class="mb-3">
        <label class="form-label">SMS Recipients (comma-separated)</label>
        <input
            v-model="$parent.notification.smsRecipients"
            type="text"
            class="form-control"
        />
    </div>
    <div class="mb-3">
        <label class="form-label">Email Template ID</label>
        <input
            v-model="$parent.notification.emailTemplateId"
            type="text"
            class="form-control"
        />
    </div>
    <div class="mb-3">
        <label class="form-label">SMS Template ID</label>
        <input
            v-model="$parent.notification.smsTemplateId"
            type="text"
            class="form-control"
            required
        />
    </div>
</template>
<script>
export default {
    data() {
        return {
            showApiKey: false,
            newApiKey: "",
        };
    },
    methods: {
        toggleApiKey() {
            if (this.showApiKey) {
                this.newApiKey = "";
            }
            this.showApiKey = !this.showApiKey;
        },
    },
};
</script>
