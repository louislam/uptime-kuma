<template>
    <div class="oidc-callback-container">
        <div v-if="error" class="oidc-box">
            <h5>SSO Login Failed</h5>
            <p class="text-danger">{{ error }}</p>
            <a href="/" class="btn btn-outline-secondary btn-sm">Return to login</a>
        </div>
        <div v-else class="oidc-box">
            <div class="spinner-border text-primary mb-3" role="status" />
            <p>Signing in&hellip;</p>
        </div>
    </div>
</template>

<script>
export default {
    name: "OidcCallback",

    data() {
        return {
            error: null,
        };
    },

    async mounted() {
        const params = new URLSearchParams(window.location.search);
        const oidcError = params.get("oidc_error");

        if (oidcError) {
            this.error = "SSO error: " + decodeURIComponent(oidcError).replace(/_/g, " ");
            return;
        }

        const code = params.get("code");
        if (!code) {
            this.error = "Missing authentication code";
            return;
        }

        try {
            const res = await fetch("/auth/oidc/token?code=" + encodeURIComponent(code));
            const data = await res.json();

            if (!data.ok) {
                this.error = data.msg || "Authentication failed";
                return;
            }

            // Store token using the same storage the app uses (respects "remember me")
            this.$root.storage().token = data.token;
            window.location.href = "/dashboard";
        } catch (err) {
            this.error = "Login failed: " + err.message;
        }
    },
};
</script>

<style scoped>
.oidc-callback-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
}

.oidc-box {
    text-align: center;
    padding: 2rem;
}
</style>
