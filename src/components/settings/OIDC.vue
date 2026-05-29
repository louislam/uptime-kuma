<template>
    <div class="my-4">
        <h5 class="settings-subheading">{{ $t("OIDC / OAuth 2.0") }}</h5>

        <div class="mb-3 form-check form-switch">
            <input
                id="oidc-enabled"
                v-model="settings.oidcEnabled"
                class="form-check-input"
                type="checkbox"
                role="switch"
            />
            <label class="form-check-label" for="oidc-enabled">{{ $t("Enable OIDC SSO") }}</label>
        </div>

        <template v-if="settings.oidcEnabled">
            <div class="mb-3">
                <label class="form-label">{{ $t("Issuer / Discovery URL") }}</label>
                <input v-model="settings.oidcIssuerUrl" type="url" class="form-control" placeholder="https://accounts.google.com" />
                <div class="form-text">{{ $t("The OIDC provider's base URL. Must expose a /.well-known/openid-configuration endpoint.") }}</div>
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("Client ID") }}</label>
                <input v-model="settings.oidcClientId" type="text" class="form-control" />
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("Client Secret") }}</label>
                <input v-model="settings.oidcClientSecret" type="password" class="form-control" autocomplete="new-password" />
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("Username Claim") }}</label>
                <input v-model="settings.oidcUsernameAttr" type="text" class="form-control" placeholder="email" />
                <div class="form-text">{{ $t("ID token claim to use as the username (e.g. email, preferred_username, sub).") }}</div>
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("Scopes") }} <span class="text-muted">({{ $t("optional") }})</span></label>
                <input v-model="settings.oidcScopes" type="text" class="form-control" placeholder="openid email profile" />
                <div class="form-text">{{ $t("Space-separated list of scopes to request. Defaults to: openid email profile") }}</div>
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("Redirect / Callback URL") }} <span class="text-muted">({{ $t("optional override") }})</span></label>
                <input v-model="settings.oidcCallbackUrl" type="url" class="form-control" :placeholder="callbackUrlPlaceholder" />
                <div class="form-text">{{ $t("Auto-derived from your server URL if blank. Register this URL with your OIDC provider.") }}</div>
            </div>

            <div class="mb-4 p-3 rounded" style="border: 1px solid rgba(0,0,0,0.12);">
                <div class="fw-bold small mb-2">{{ $t("Register these values with your OIDC provider") }}</div>
                <div class="small">
                    <span class="text-muted">{{ $t("Redirect URI") }}:</span>
                    <code class="ms-2">{{ settings.oidcCallbackUrl || callbackUrlPlaceholder }}</code>
                </div>
            </div>
        </template>

        <button class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? $t("Saving...") : $t("Save") }}
        </button>
    </div>
</template>

<script>
export default {
    data() {
        return {
            saving: false,
            settings: {
                oidcEnabled: false,
                oidcIssuerUrl: "",
                oidcClientId: "",
                oidcClientSecret: "",
                oidcUsernameAttr: "",
                oidcScopes: "",
                oidcCallbackUrl: "",
            },
        };
    },

    computed: {
        callbackUrlPlaceholder() {
            return `${window.location.origin}/auth/oidc/callback`;
        },
    },

    mounted() {
        this.load();
    },

    methods: {
        load() {
            this.$root.getSocket().emit("getOIDCSettings", (res) => {
                if (res.ok) {
                    const s = res.data;
                    this.settings.oidcEnabled = !!s.oidcEnabled;
                    this.settings.oidcIssuerUrl = s.oidcIssuerUrl || "";
                    this.settings.oidcClientId = s.oidcClientId || "";
                    this.settings.oidcClientSecret = s.oidcClientSecret || "";
                    this.settings.oidcUsernameAttr = s.oidcUsernameAttr || "";
                    this.settings.oidcScopes = s.oidcScopes || "";
                    this.settings.oidcCallbackUrl = s.oidcCallbackUrl || "";
                }
            });
        },

        save() {
            this.saving = true;
            this.$root.getSocket().emit("setOIDCSettings", this.settings, (res) => {
                this.saving = false;
                this.$root.toastRes(res);
            });
        },
    },
};
</script>
