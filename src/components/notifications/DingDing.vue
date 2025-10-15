<template>
    <div class="mb-3">
        <label for="WebHookUrl" class="form-label">{{ $t("WebHookUrl") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="WebHookUrl" v-model="$parent.notification.webHookUrl" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="secretKey" class="form-label">{{ $t("SecretKey") }}<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="secretKey" v-model="$parent.notification.secretKey" :required="true" autocomplete="new-password"></HiddenInput>

        <div class="form-text">
            <p>{{ $t("For safety, must use secret key") }}</p>
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://developers.dingtalk.com/document/robots/custom-robot-access" target="_blank">https://developers.dingtalk.com/document/robots/custom-robot-access</a> <a href="https://open.dingtalk.com/document/robots/customize-robot-security-settings#title-7fs-kgs-36x" target="_blank">https://open.dingtalk.com/document/robots/customize-robot-security-settings#title-7fs-kgs-36x</a>
            </i18n-t>
        </div>
    </div>
    <div class="mb-3">
        <label for="mentioning" class="form-label">{{ $t("Mentioning") }}<span style="color: red;"><sup>*</sup></span></label>
        <select id="mentioning" v-model="$parent.notification.mentioning" class="form-select" required @change="onMentioningChange">
            <option value="nobody">{{ $t("Don't mention people") }}</option>
            <option value="everyone">{{ $t("Mention group", { group: "@everyone" }) }}</option>
            <option value="specify-mobiles">{{ $t("Mention Mobile List") }}</option>
            <option value="specify-users">{{ $t("Mention User List") }}</option>
        </select>
    </div>
    <div v-if="$parent.notification.mentioning === 'specify-mobiles'" class="mb-3">
        <label for="mobileList" class="form-label">{{ $t("Dingtalk Mobile List") }}<span style="color: red;"><sup>*</sup></span></label>
        <VueMultiselect
            id="mobileList-select"
            v-model="$parent.notification.mobileList"
            :required="$parent.notification.mentioning === 'specify-mobiles'"
            :placeholder="$t('Enter a list of mobile')"
            :multiple="true"
            :options="mobileOpts"
            :max-height="500"
            :taggable="true"
            :show-no-options="false"
            :close-on-select="false"
            :clear-on-select="false"
            :preserve-search="false"
            :preselect-first="false"
            @remove="removeMobile"
            @tag="addMobile"
        ></VueMultiselect>
    </div>
    <div v-if="$parent.notification.mentioning === 'specify-users'" class="mb-3">
        <label for="userList" class="form-label">{{ $t("Dingtalk User List") }}<span style="color: red;"><sup>*</sup></span></label>
        <VueMultiselect
            id="userList-select"
            v-model="$parent.notification.userList"
            :required="$parent.notification.mentioning === 'specify-users'"
            :placeholder="$t('Enter a list of userId')"
            :multiple="true"
            :options="userIdOpts"
            :max-height="500"
            :taggable="true"
            :show-no-options="false"
            :close-on-select="false"
            :clear-on-select="true"
            :preserve-search="false"
            :preselect-first="false"
            @remove="removeUser"
            @tag="addUser"
        ></VueMultiselect>
    </div>
</template>

<script lang="ts">
import HiddenInput from "../HiddenInput.vue";
import VueMultiselect from "vue-multiselect";

export default {
    components: {
        HiddenInput,
        VueMultiselect
    },
    data() {
        return {
            mobileOpts: [],
            userIdOpts: [],
        };
    },

    mounted() {
        if (typeof this.$parent.notification.mentioning === "undefined") {
            this.$parent.notification.mentioning = "nobody";
        }
        if (typeof this.$parent.notification.mobileList === "undefined") {
            this.$parent.notification.mobileList = [];
        } else {
            this.mobileOpts = this.$parent.notification.mobileList;
        }

        if (typeof this.$parent.notification.userList === "undefined") {
            this.$parent.notification.userList = [];
        } else {
            this.userIdOpts = this.$parent.notification.userList;
        }
    },
    methods: {
        onMentioningChange(e) {
            if (e.target.value === "specify-mobiles") {
                this.$parent.notification.userList = [];
            } else if (e.target.value === "specify-users") {
                this.$parent.notification.mobileList = [];
            } else {
                this.$parent.notification.userList = [];
                this.$parent.notification.mobileList = [];
            }
        },
        addMobile(mobile) {
            const trimmedMobile = mobile.trim();
            const chinaMobileRegex = /^1[3-9]\d{9}$/;
            if (!chinaMobileRegex.test(trimmedMobile)) {
                this.$root.toastError(this.$t("Invalid mobile", { "mobile": trimmedMobile }));
                return;
            }
            this.mobileOpts.push(mobile);
        },
        removeMobile(mobile) {
            const idx = this.mobileOpts.indexOf(mobile);
            if (idx > -1) {
                this.mobileOpts.splice(idx, 1);
            }
        },
        addUser(userId) {
            const trimmedUserId = userId.trim();
            const userIdRegex = /^[a-zA-Z0-9]+$/;
            if (!userIdRegex.test(trimmedUserId)) {
                this.$root.toastError(this.$t("Invalid userId", { "userId": trimmedUserId }));
                return;
            }
            this.userIdOpts.push(trimmedUserId);
        },
        removeUser(userId) {
            const idx = this.userIdOpts.indexOf(userId);
            if (idx > -1) {
                this.userIdOpts.splice(idx, 1);
            }
        },
    }
};
</script>
