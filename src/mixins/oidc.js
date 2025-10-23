/**
 * OIDC Frontend Service
 * Handles OIDC provider discovery and authentication flow
 */

export default {
    data() {
        return {
            oidcProviders: [],
            oidcLoading: false,
            oidcError: null,
        };
    },

    methods: {
        /**
         * Fetch available OIDC providers from backend
         * @returns {Promise<Array>} List of enabled OIDC providers
         */
        async fetchOidcProviders() {
            this.oidcLoading = true;
            this.oidcError = null;

            try {
                const response = await fetch("/oidc/providers", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (data.status === "ok" && Array.isArray(data.providers)) {
                    // Filter only enabled providers for login page
                    this.oidcProviders = data.providers.filter(provider => provider.is_enabled);
                    return this.oidcProviders;
                } else {
                    console.warn("OIDC providers response format unexpected:", data);
                    this.oidcProviders = [];
                    return [];
                }
            } catch (error) {
                console.error("Failed to fetch OIDC providers:", error);
                this.oidcError = this.$t ? this.$t("Failed to load SSO providers") : "Failed to load SSO providers";
                this.oidcProviders = [];
                return [];
            } finally {
                this.oidcLoading = false;
            }
        },

        /**
         * Initiate OIDC login flow
         * @param {string} providerId - The provider ID to login with
         * @returns {Promise<void>} Promise that resolves when login is initiated
         */
        async initiateOidcLogin(providerId) {
            try {
                const provider = this.oidcProviders.find(p => p.id === providerId);
                if (!provider) {
                    throw new Error("Provider not found");
                }

                // Redirect to backend OAuth initiation endpoint
                window.location.href = `/oidc/login/${provider.id}`;
            } catch (error) {
                console.error("Failed to initiate OIDC login:", error);
                this.oidcError = this.$t ? this.$t("Failed to start SSO login") : "Failed to start SSO login";
            }
        },

        /**
         * Get provider display name
         * @param {object} provider - Provider object
         * @returns {string} Display name
         */
        getProviderDisplayName(provider) {
            return provider.name || provider.provider_type || "SSO Provider";
        },

        /**
         * Get provider button class for styling
         * @param {object} provider - Provider object
         * @returns {string} CSS class name
         */
        getProviderButtonClass(provider) {
            const typeClasses = {
                pingfederate: "btn-pingfederate",
            };

            const baseClass = "btn btn-outline-primary oidc-btn";
            const typeClass = typeClasses[provider.provider_type] || "btn-oidc-default";

            return `${baseClass} ${typeClass}`;
        },

        /**
         * Get provider icon
         * @param {object} provider - Provider object
         * @returns {string} Icon class name
         */
        getProviderIcon(provider) {
            const iconMap = {
                pingfederate: "fas fa-server",
            };

            return iconMap[provider.provider_type] || "fas fa-sign-in-alt";
        },

        /**
         * Clear OIDC error message
         * @returns {void}
         */
        clearOidcError() {
            this.oidcError = null;
        },

        /**
         * Check if OIDC is available
         * @returns {boolean} True if OIDC providers are available
         */
        hasOidcProviders() {
            return this.oidcProviders && this.oidcProviders.length > 0;
        },
    },
};
