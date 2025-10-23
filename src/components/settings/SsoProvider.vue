<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <!-- Header -->
            <div class="mb-4">
                <h5 class="settings-subheading">{{ $t("SSO Provider") }}</h5>
                <p class="text-muted">{{ $t("Configure your OpenID Connect authentication provider for single sign-on") }}</p>
            </div>

            <!-- Single Provider Configuration Form -->
            <div class="shadow-box">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h6 class="mb-0">{{ $t("Provider Configuration") }}</h6>
                    <div v-if="hasProvider" class="text-muted small">
                        <font-awesome-icon icon="info-circle" class="me-1" />
                        {{ $t("Saving will replace your current provider configuration") }}
                    </div>
                </div>

                <div v-if="loading" class="text-center py-4">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">{{ $t("Loading...") }}</span>
                    </div>
                </div>

                <form v-else @submit.prevent="saveProvider">
                    <!-- Basic Information -->
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="provider-name" class="form-label">{{ $t("Provider Display Name") }} *</label>
                                <input
                                    id="provider-name"
                                    v-model="providerForm.name"
                                    type="text"
                                    class="form-control"
                                    :placeholder="$t('e.g., Company SSO')"
                                    required
                                />
                                <div class="form-text">{{ $t("Name shown to users on login page") }}</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="description" class="form-label">{{ $t("Description") }}</label>
                                <input
                                    id="description"
                                    v-model="providerForm.description"
                                    type="text"
                                    class="form-control"
                                    :placeholder="$t('e.g., Company OIDC provider')"
                                />
                                <div class="form-text">{{ $t("Optional description for this provider") }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Provider Type and Status -->
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="provider-type" class="form-label">{{ $t("Provider Type") }} *</label>
                                <select
                                    id="provider-type"
                                    v-model="providerForm.provider_type"
                                    class="form-select"
                                    required
                                >
                                    <option value="">{{ $t("Select Provider Type") }}</option>
                                    <option value="generic">{{ $t("Generic OpenID Connect") }}</option>
                                    <option value="google">{{ $t("Google") }}</option>
                                    <option value="microsoft">{{ $t("Microsoft") }}</option>
                                    <option value="auth0">{{ $t("Auth0") }}</option>
                                    <option value="okta">{{ $t("Okta") }}</option>
                                    <option value="pingfederate">{{ $t("PingFederate") }}</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="form-label">{{ $t("Status") }}</label>
                                <div class="form-check form-switch">
                                    <input
                                        id="provider-enabled"
                                        v-model="providerForm.enabled"
                                        class="form-check-input"
                                        type="checkbox"
                                    />
                                    <label class="form-check-label" for="provider-enabled">
                                        {{ providerForm.enabled ? $t("Enabled") : $t("Disabled") }}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- OIDC Endpoints -->
                    <div class="mb-3">
                        <label for="issuer" class="form-label">{{ $t("Issuer") }} *</label>
                        <input
                            id="issuer"
                            v-model="providerForm.issuer"
                            type="url"
                            class="form-control"
                            :placeholder="$t('https://your-provider.com')"
                            required
                        />
                        <div class="form-text">{{ $t("OIDC issuer URL") }}</div>
                    </div>

                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="authorization-endpoint" class="form-label">{{ $t("Authorization Endpoint") }} *</label>
                                <input
                                    id="authorization-endpoint"
                                    v-model="providerForm.authorization_endpoint"
                                    type="url"
                                    class="form-control"
                                    :placeholder="$t('https://your-provider.com/auth')"
                                    required
                                />
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="token-endpoint" class="form-label">{{ $t("Token Endpoint") }} *</label>
                                <input
                                    id="token-endpoint"
                                    v-model="providerForm.token_endpoint"
                                    type="url"
                                    class="form-control"
                                    :placeholder="$t('https://your-provider.com/token')"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label for="userinfo-endpoint" class="form-label">{{ $t("User Info Endpoint") }} *</label>
                        <input
                            id="userinfo-endpoint"
                            v-model="providerForm.userinfo_endpoint"
                            type="url"
                            class="form-control"
                            :placeholder="$t('https://your-provider.com/userinfo')"
                            required
                        />
                        <div class="form-text">{{ $t("Endpoint to retrieve user information") }}</div>
                    </div>

                    <!-- OAuth Credentials -->
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="client-id" class="form-label">{{ $t("Client ID") }} *</label>
                                <input
                                    id="client-id"
                                    v-model="providerForm.client_id"
                                    type="text"
                                    class="form-control"
                                    required
                                />
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="client-secret" class="form-label">{{ $t("Client Secret") }} *</label>
                                <input
                                    id="client-secret"
                                    v-model="providerForm.client_secret"
                                    type="password"
                                    class="form-control"
                                    :placeholder="hasProvider ? $t('Leave blank to keep current') : $t('Enter client secret')"
                                    :required="!hasProvider"
                                />
                                <div class="form-text">{{ $t("Will be encrypted when stored") }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Additional Configuration -->
                    <div class="mb-3">
                        <label for="scopes" class="form-label">{{ $t("Scopes") }}</label>
                        <input
                            id="scopes"
                            v-model="providerForm.scopes"
                            type="text"
                            class="form-control"
                            :placeholder="$t('openid profile email')"
                        />
                        <div class="form-text">{{ $t("Space-separated list of OAuth scopes") }}</div>
                    </div>

                    <!-- Save Button -->
                    <div class="d-flex justify-content-end pt-3 border-top">
                        <button type="submit" class="btn btn-primary" :disabled="saving">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                            <font-awesome-icon icon="save" class="me-1" />
                            {{ hasProvider ? $t("Update Provider") : $t("Save Provider") }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            currentProvider: null,
            loading: false,
            saving: false,
            providerForm: {
                provider_type: "",
                name: "",
                description: "",
                issuer: "",
                authorization_endpoint: "",
                token_endpoint: "",
                userinfo_endpoint: "",
                client_id: "",
                client_secret: "",
                scopes: "openid profile email",
                enabled: true,
            },
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
        hasProvider() {
            return this.currentProvider !== null && this.currentProvider !== undefined;
        }
    },

    mounted() {
        this.loadProvider();
    },

    methods: {
        /**
         * Load the current OIDC provider (if any)
         * @returns {Promise<void>}
         */
        async loadProvider() {
            this.loading = true;
            try {
                const response = await fetch("/oidc/admin/providers", {
                    credentials: "include"
                });

                if (response.ok) {
                    const data = await response.json();
                    const providers = data.providers || [];

                    if (providers.length > 0) {
                        // Load the first (and should be only) provider
                        this.currentProvider = providers[0];
                        this.loadProviderIntoForm(this.currentProvider);
                    } else {
                        // No provider exists, show empty form (first time setup)
                        this.currentProvider = null;
                        this.resetForm();
                    }
                } else {
                    // For first time setup, any error just shows empty form
                    // No error toast needed - user can proceed with configuration
                    this.currentProvider = null;
                    this.resetForm();
                }
            } catch (error) {
                // Network errors or database not initialized - show empty form
                this.currentProvider = null;
                this.resetForm();
            } finally {
                this.loading = false;
            }
        },

        /**
         * Load provider data into the form
         * @param {object} provider - Provider configuration object
         * @returns {void}
         */
        loadProviderIntoForm(provider) {
            this.providerForm = {
                provider_type: provider.provider_type || "",
                name: provider.name || "",
                description: provider.description || "",
                issuer: provider.issuer || "",
                authorization_endpoint: provider.authorization_endpoint || "",
                token_endpoint: provider.token_endpoint || "",
                userinfo_endpoint: provider.userinfo_endpoint || "",
                client_id: provider.client_id || "",
                client_secret: "", // Never populate secret field
                scopes: Array.isArray(provider.scopes) ? provider.scopes.join(" ") : (provider.scopes || "openid profile email"),
                enabled: provider.enabled !== undefined ? provider.enabled : true,
            };
        },

        /**
         * Save provider (create new or update existing)
         * @returns {Promise<void>}
         */
        async saveProvider() {
            this.saving = true;
            try {
                let url;
                let method;

                if (this.hasProvider) {
                    // Update existing provider
                    url = `/oidc/admin/providers/${this.currentProvider.id}`;
                    method = "PUT";
                } else {
                    // Create new provider (but first delete any existing ones for single provider approach)
                    await this.deleteExistingProviders();
                    url = "/oidc/admin/providers";
                    method = "POST";
                }

                // Prepare data - convert scopes string to array
                const providerData = {
                    ...this.providerForm,
                    scopes: this.providerForm.scopes ? this.providerForm.scopes.split(" ").filter(s => s.trim()) : [ "openid", "profile", "email" ]
                };

                const response = await fetch(url, {
                    method: method,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify(providerData)
                });

                const data = await response.json();

                if (response.ok) {
                    this.$root.toastSuccess(
                        this.hasProvider
                            ? this.$t("Provider updated successfully")
                            : this.$t("Provider saved successfully")
                    );

                    // Reload provider data
                    await this.loadProvider();
                } else {
                    this.$root.toastError(data.message || this.$t("Failed to save provider"));
                }
            } catch (error) {
                console.error("Error saving provider:", error);
                this.$root.toastError(this.$t("Failed to save provider"));
            } finally {
                this.saving = false;
            }
        },

        /**
         * Delete existing providers to maintain single provider approach
         * @returns {Promise<void>}
         */
        async deleteExistingProviders() {
            try {
                const response = await fetch("/oidc/admin/providers", {
                    credentials: "include"
                });

                if (response.ok) {
                    const data = await response.json();
                    const providers = data.providers || [];

                    // Delete all existing providers
                    for (const provider of providers) {
                        await fetch(`/oidc/admin/providers/${provider.id}`, {
                            method: "DELETE",
                            credentials: "include"
                        });
                    }
                }
            } catch (error) {
                console.error("Error deleting existing providers:", error);
                // Continue anyway - not critical for the save operation
            }
        },

        /**
         * Reset the provider form to empty state
         * @returns {void}
         */
        resetForm() {
            this.providerForm = {
                provider_type: "",
                name: "",
                description: "",
                issuer: "",
                authorization_endpoint: "",
                token_endpoint: "",
                userinfo_endpoint: "",
                client_id: "",
                client_secret: "",
                scopes: "openid profile email",
                enabled: true,
            };
        },
    },
};
</script>

<style scoped>
.settings-subheading {
    font-weight: 600;
    color: var(--bs-dark);
}

.shadow-box {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 1.5rem;
}

.form-text {
    font-size: 0.875em;
    color: var(--bs-secondary);
}

.spinner-border-sm {
    width: 1rem;
    height: 1rem;
}

.border-top {
    border-color: var(--bs-border-color) !important;
}
</style>
