<template>
    <div class="mb-3">
        <label for="ntfy-ntfytopic" class="form-label">{{ $t("ntfy Topic") }}</label>
        <input id="ntfy-ntfytopic" v-model="$parent.notification.ntfytopic" type="text" class="form-control" required />
    </div>
    <div class="mb-3">
        <label for="ntfy-server-url" class="form-label">{{ $t("Server URL") }}</label>
        <input
            id="ntfy-server-url"
            v-model="$parent.notification.ntfyserverurl"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">
            {{ $t("Server URL should not contain the nfty topic") }}
        </div>
    </div>
    <div class="mb-3">
        <label for="ntfy-priority" class="form-label">{{ $t("Priority") }}</label>
        <input
            id="ntfy-priority"
            v-model="$parent.notification.ntfyPriority"
            type="number"
            class="form-control"
            required
            min="1"
            max="5"
            step="1"
        />
        <label for="ntfy-priority-down" class="form-label">{{ $t("ntfyPriorityDown") }}</label>
        <input
            id="ntfy-priority-down"
            v-model="$parent.notification.ntfyPriorityDown"
            type="number"
            class="form-control"
            required
            min="1"
            max="5"
            step="1"
        />
        <div class="form-text">
            <p
                v-if="
                    $parent.notification.ntfyPriority == $parent.notification.ntfyPriorityDown &&
                    $parent.notification.ntfyPriority >= 5
                "
            >
                {{ $t("ntfyPriorityHelptextAllEvents") }}
            </p>
            <i18n-t
                v-else-if="$parent.notification.ntfyPriority > $parent.notification.ntfyPriorityDown"
                tag="p"
                keypath="ntfyPriorityHelptextPriorityHigherThanDown"
            >
                <code>DOWN</code>
                <code>{{ $parent.notification.ntfyPriority }}</code>
                <code>{{ $parent.notification.ntfyPriorityDown }}</code>
            </i18n-t>
            <i18n-t v-else tag="p" keypath="ntfyPriorityHelptextAllExceptDown">
                <code>DOWN</code>
                <code>{{ $parent.notification.ntfyPriorityDown }}</code>
            </i18n-t>
        </div>
    </div>
    <div class="mb-3">
        <label for="authentication-method" class="form-label">{{ $t("ntfyAuthenticationMethod") }}</label>
        <select id="authentication-method" v-model="$parent.notification.ntfyAuthenticationMethod" class="form-select">
            <option v-for="(name, type) in authenticationMethods" :key="type" :value="type">{{ name }}</option>
        </select>
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'usernamePassword'" class="mb-3">
        <label for="ntfy-username" class="form-label">{{ $t("Username") }}</label>
        <input id="ntfy-username" v-model="$parent.notification.ntfyusername" type="text" class="form-control" />
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'usernamePassword'" class="mb-3">
        <label for="ntfy-password" class="form-label">{{ $t("Password") }}</label>
        <HiddenInput
            id="ntfy-password"
            v-model="$parent.notification.ntfypassword"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'accessToken'" class="mb-3">
        <label for="ntfy-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <HiddenInput id="ntfy-access-token" v-model="$parent.notification.ntfyaccesstoken"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="ntfy-icon" class="form-label">{{ $t("IconUrl") }}</label>
        <input id="ntfy-icon" v-model="$parent.notification.ntfyIcon" type="text" class="form-control" />
    </div>
    <div class="mb-3">
        <label for="ntfy-call" class="form-label">{{ $t("ntfyCall") }}</label>
        <input
            id="ntfy-call"
            v-model="$parent.notification.ntfyCall"
            type="text"
            class="form-control"
            placeholder="yes or +12223334444"
        />
        <div class="form-text">
            {{ $t("ntfyCallHelptext") }}
        </div>
    </div>

    <ToggleSection
        :heading="$t('ntfyCustomTemplatesOptional')"
        :default-open="hasNtfyTemplates"
    >
        <div class="form-text mb-3">
            <div class="mb-2">
                <i18n-t tag="span" keypath="liquidIntroduction">
                    <a href="https://liquidjs.com/" target="_blank">{{ $t("documentation") }}</a>
                </i18n-t>
            </div>
            <div class="mb-2">
                <strong>{{ $t("templateAvailableVariables") }}:</strong>
                <code v-pre>{{ status }}</code>, 
                <code v-pre>{{ name }}</code>, 
                <code v-pre>{{ hostnameOrURL }}</code>, 
                <code v-pre>{{ msg }}</code>, 
                <code v-pre>{{ monitorJSON }}</code>, 
                <code v-pre>{{ heartbeatJSON }}</code>
            </div>
            <div class="mt-3 p-2" style="background-color: rgba(100, 100, 100, 0.1); border-radius: 4px;">
                <div class="mb-1"><strong>{{ $t("example") }}:</strong></div>
                <div class="mb-2">
                    <code style="font-size: 0.85em; word-break: break-all;" v-pre>{% for tag in monitorJSON.tags %}{{ tag.name }}{% unless tag.value == blank %}: {{ tag.value }}{% endunless %}{% unless forloop.last %}, {% endunless %}{% endfor %}</code>
                </div>
                <div style="font-size: 0.9em;">
                    <strong>{{ $t("Result") }}:</strong> <span style="opacity: 0.9;">nightly, phone: fbal</span>
                </div>
            </div>
        </div>

        <div class="mb-3">
            <label for="ntfy-title" class="form-label">{{ $t("ntfyCustomTitle") }}</label>
            <input
                id="ntfy-title"
                v-model="$parent.notification.ntfyCustomTitle"
                type="text"
                class="form-control"
                autocomplete="off"
            />
            <div class="form-text">{{ $t("ntfyNotificationTemplateFallback") }}</div>
        </div>

        <div class="mb-3">
            <label for="ntfy-message" class="form-label">{{ $t("ntfyCustomMessage") }}</label>
            <textarea
                ref="ntfyMessage"
                id="ntfy-message"
                v-model="$parent.notification.ntfyCustomMessage"
                class="form-control auto-expand-textarea"
                autocomplete="off"
                @input="autoResizeTextarea"
            ></textarea>
            <div class="form-text">{{ $t("ntfyNotificationTemplateFallback") }}</div>
        </div>
    </ToggleSection>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import ToggleSection from "../ToggleSection.vue";

export default {
    components: {
        HiddenInput,
        ToggleSection,
    },
    computed: {
        authenticationMethods() {
            return {
                none: this.$t("None"),
                usernamePassword: this.$t("ntfyUsernameAndPassword"),
                accessToken: this.$t("Access Token"),
            };
        },
        hasNtfyTemplates() {
            return !!(this.$parent.notification.ntfyCustomTitle || this.$parent.notification.ntfyCustomMessage);
        },
    },
    mounted() {
        if (typeof this.$parent.notification.ntfyPriority === "undefined") {
            this.$parent.notification.ntfyserverurl = "https://ntfy.sh";
            this.$parent.notification.ntfyPriority = 5;
        }

        // Setting down priority if it's undefined
        if (typeof this.$parent.notification.ntfyPriorityDown === "undefined") {
            this.$parent.notification.ntfyPriorityDown = 5;
        }

        // Handling notifications that added before 1.22.0
        if (typeof this.$parent.notification.ntfyAuthenticationMethod === "undefined") {
            if (!this.$parent.notification.ntfyusername) {
                this.$parent.notification.ntfyAuthenticationMethod = "none";
            } else {
                this.$parent.notification.ntfyAuthenticationMethod = "usernamePassword";
            }
        }

        // Auto-resize textareas after mount
        this.autoResizeTextarea();
    },
    methods: {
        /**
         * Auto-resize textarea based on content
         * @returns {void}
         */
        autoResizeTextarea() {
            this.$nextTick(() => {
                const textareas = this.$el.querySelectorAll('.auto-expand-textarea');
                textareas.forEach(textarea => {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.max(100, textarea.scrollHeight) + 'px';
                });
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.auto-expand-textarea {
    min-height: 100px;
    max-height: 500px;
    overflow-y: auto;
    resize: vertical;
}
</style>
