<template>
    <div class="mb-3">
        <label for="jsm-cloud-id" class="form-label">
            {{ $t("Cloud ID") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input id="jsm-cloud-id" v-model="$parent.notification.jsmCloudId" type="text" class="form-control" required />
        <i18n-t tag="p" keypath="aboutJiraCloudId" style="margin-top: 8px">
            <a href="https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/" target="_blank">
                {{ $t("see Jira Cloud Docs") }}
            </a>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="jsm-email" class="form-label">
            {{ $t("Email") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input id="jsm-email" v-model="$parent.notification.jsmEmail" type="email" class="form-control" required />
    </div>
    <div class="mb-3">
        <label for="jsm-api-token" class="form-label">
            {{ $t("API Token") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <HiddenInput
            id="jsm-api-token"
            v-model="$parent.notification.jsmApiToken"
            required="true"
            autocomplete="false"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="jsm-priority" class="form-label">{{ $t("Priority") }}</label>
        <input
            id="jsm-priority"
            v-model="$parent.notification.jsmPriority"
            type="number"
            class="form-control"
            min="1"
            max="5"
            step="1"
        />
    </div>
    <div class="form-text">
        <span style="color: red"><sup>*</sup></span>
        {{ $t("Required") }}
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
export default {
    components: {
        HiddenInput,
    },
};
</script>
