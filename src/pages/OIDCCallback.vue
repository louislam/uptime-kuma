<template>
    <div class="form-container">
        <div class="form text-center">
            <div v-if="state === 'processing'">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">{{ $t("Loading") }}</span>
                </div>
                <p class="mb-0">{{ $t("oidcProcessing") }}</p>
            </div>
            <div v-else>
                <div class="alert alert-danger" role="alert">
                    {{ errorMessage }}
                </div>
                <router-link class="btn btn-primary" to="/dashboard">
                    {{ $t("oidcGoBack") }}
                </router-link>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            state: "processing",
            errorKey: null,
            errorValues: null,
        };
    },

    computed: {
        errorMessage() {
            if (!this.errorKey) {
                return "";
            }

            if (this.errorValues) {
                return this.$t(this.errorKey, this.errorValues);
            }

            return this.$t(this.errorKey);
        },
    },

    mounted() {
        document.title += " - OIDC";
        const query = this.$route.query || {};

        if (query.error) {
            this.setError(query.error);
            return;
        }

        const token = typeof query.token === "string" ? query.token : null;
        const redirect = typeof query.redirect === "string" && query.redirect.startsWith("/") ? query.redirect : "/dashboard";

        if (!token) {
            this.setError("oidcGenericError");
            return;
        }

        this.$root.storage().token = token;
        this.$root.socket.token = token;

        this.$root.loginByToken(token, (res) => {
            if (res?.ok) {
                this.state = "processing";
                this.$router.replace(redirect);
            } else {
                if (res?.msgi18n) {
                    if (typeof res.msg === "object" && res.msg?.key) {
                        this.setError(res.msg.key, res.msg.values || {});
                    } else if (typeof res.msg === "string") {
                        this.setError(res.msg);
                    } else {
                        this.setError("oidcGenericError");
                    }
                } else {
                    this.setError("oidcGenericError");
                }
            }
        });
    },

    beforeUnmount() {
        document.title = document.title.replace(" - OIDC", "");
    },

    methods: {
        setError(key, values = null) {
            this.state = "error";
            this.errorKey = key;
            this.errorValues = values;
        },
    },
};
</script>

<style scoped lang="scss">
.form-container {
    display: flex;
    align-items: center;
    padding-top: 40px;
    padding-bottom: 40px;
}

.form {
    width: 100%;
    max-width: 330px;
    padding: 15px;
    margin: auto;
}
</style>
