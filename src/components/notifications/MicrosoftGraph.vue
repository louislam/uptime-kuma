<template>
    <div>
        <i18n-t tag="p" keypath="msGraphSetupDescription" class="form-text">
            <template #appRegistration>
                <a
                    href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {{ $t("msGraphAppRegistration") }}
                </a>
            </template>
            <template #mailSend>
                <a
                    href="https://learn.microsoft.com/en-us/graph/permissions-reference#mailsend"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <code>Mail.Send</code>
                </a>
            </template>
            <template #consent>
                <a
                    href="https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent?pivots=portal"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {{ $t("msGraphConsent") }}
                </a>
            </template>
            <template #rbac>
                <a
                    href="https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {{ $t("msGraphRbac") }}
                </a>
            </template>
        </i18n-t>

        <div class="mb-3">
            <label for="ms-graph-tenant-id" class="form-label">{{ $t("Tenant ID") }}</label>
            <input
                id="ms-graph-tenant-id"
                v-model="$parent.notification.msGraphTenantId"
                type="text"
                class="form-control"
                required
                autocomplete="false"
                placeholder="00000000-0000-0000-0000-000000000000"
            />
            <div class="form-text">{{ $t("msGraphTenantIdDescription") }}</div>
        </div>

        <div class="mb-3">
            <label for="ms-graph-client-id" class="form-label">{{ $t("Client ID") }}</label>
            <input
                id="ms-graph-client-id"
                v-model="$parent.notification.msGraphClientId"
                type="text"
                class="form-control"
                required
                autocomplete="false"
                placeholder="00000000-0000-0000-0000-000000000000"
            />
        </div>

        <div class="mb-3">
            <label for="ms-graph-client-secret" class="form-label">{{ $t("Client Secret") }}</label>
            <HiddenInput
                id="ms-graph-client-secret"
                v-model="$parent.notification.msGraphClientSecret"
                :required="true"
                autocomplete="new-password"
            ></HiddenInput>
            <i18n-t tag="div" keypath="msGraphClientSecretDescription" class="form-text">
                <template #clientSecret>
                    <a
                        href="https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials?tabs=client-secret"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {{ $t("msGraphClientSecretLink") }}
                    </a>
                </template>
            </i18n-t>
        </div>

        <div class="mb-3">
            <label for="ms-graph-mailbox" class="form-label">{{ $t("msGraphMailbox") }}</label>
            <input
                id="ms-graph-mailbox"
                v-model="$parent.notification.msGraphMailbox"
                type="text"
                class="form-control"
                required
                autocomplete="false"
                placeholder="alerts@example.com"
            />
            <div class="form-text">{{ $t("msGraphMailboxDescription") }}</div>
        </div>

        <div class="mb-3">
            <label for="ms-graph-to" class="form-label">{{ $t("To Email") }}</label>
            <input
                id="ms-graph-to"
                v-model="$parent.notification.msGraphTo"
                type="text"
                class="form-control"
                autocomplete="false"
                placeholder="example2@kuma.pet, example3@kuma.pet"
                :required="!hasRecipient"
            />
        </div>

        <div class="mb-3">
            <label for="ms-graph-cc" class="form-label">{{ $t("smtpCC") }}</label>
            <input
                id="ms-graph-cc"
                v-model="$parent.notification.msGraphCC"
                type="text"
                class="form-control"
                autocomplete="false"
                :required="!hasRecipient"
            />
        </div>

        <div class="mb-3">
            <label for="ms-graph-bcc" class="form-label">{{ $t("smtpBCC") }}</label>
            <input
                id="ms-graph-bcc"
                v-model="$parent.notification.msGraphBCC"
                type="text"
                class="form-control"
                autocomplete="false"
                :required="!hasRecipient"
            />
        </div>

        <div class="mb-3">
            <label for="ms-graph-subject" class="form-label">{{ $t("emailCustomSubject") }}</label>
            <TemplatedInput
                id="ms-graph-subject"
                v-model="$parent.notification.customSubject"
                :required="false"
                placeholder=""
            ></TemplatedInput>
            <div class="form-text">{{ $t("leave blank for default subject") }}</div>
        </div>

        <div class="mb-3">
            <label for="ms-graph-body" class="form-label">{{ $t("emailCustomBody") }}</label>
            <TemplatedTextarea
                id="ms-graph-body"
                v-model="$parent.notification.customBody"
                :required="false"
                placeholder=""
            ></TemplatedTextarea>
            <div class="form-text">{{ $t("leave blank for default body") }}</div>
        </div>

        <div class="mb-3">
            <div class="form-check">
                <input
                    id="ms-graph-use-html-body"
                    v-model="$parent.notification.htmlBody"
                    class="form-check-input"
                    type="checkbox"
                    value=""
                />
                <label class="form-check-label" for="ms-graph-use-html-body">
                    {{ $t("Use HTML for custom E-mail body") }}
                </label>
            </div>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedInput from "../TemplatedInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        HiddenInput,
        TemplatedInput,
        TemplatedTextarea,
    },
    computed: {
        hasRecipient() {
            return !!(
                this.$parent.notification.msGraphTo ||
                this.$parent.notification.msGraphCC ||
                this.$parent.notification.msGraphBCC
            );
        },
    },
};
</script>
