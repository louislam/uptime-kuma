<template>
    <div class="mb-3">
        <label class="form-label">GOV Notify API Key</label>
        <input
            v-model="$parent.notification.apiKey"
            type="text"
            class="form-control"
        />
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
};
</script>
