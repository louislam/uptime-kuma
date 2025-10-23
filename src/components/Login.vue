<template>
    <div class="form-container">
        <div class="form">
            <form @submit.prevent="submit">
                <h1 class="h3 mb-3 fw-normal" />

                <div v-if="!tokenRequired" class="form-floating">
                    <input id="floatingInput" v-model="username" type="text" class="form-control" placeholder="Username" autocomplete="username" required>
                    <label for="floatingInput">{{ $t("Username") }}</label>
                </div>

                <div v-if="!tokenRequired" class="form-floating mt-3">
                    <input id="floatingPassword" v-model="password" type="password" class="form-control" placeholder="Password" autocomplete="current-password" required>
                    <label for="floatingPassword">{{ $t("Password") }}</label>
                </div>

                <div v-if="tokenRequired">
                    <div class="form-floating mt-3">
                        <input id="otp" ref="otpInput" v-model="token" type="text" maxlength="6" class="form-control" placeholder="123456" autocomplete="one-time-code" required>
                        <label for="otp">{{ $t("Token") }}</label>
                    </div>
                </div>

                <div class="form-check mb-3 mt-3 d-flex justify-content-center pe-4">
                    <div class="form-check">
                        <input id="remember" v-model="$root.remember" type="checkbox" value="remember-me" class="form-check-input">

                        <label class="form-check-label" for="remember">
                            {{ $t("Remember me") }}
                        </label>
                    </div>
                </div>
                <button class="w-100 btn btn-primary" type="submit" :disabled="processing">
                    {{ $t("Login") }}
                </button>

                <button v-if="oidcEnabled" class="w-100 btn btn-outline-secondary mt-3" type="button" :disabled="processing" @click="startOIDCLogin">
                    {{ oidcButtonLabel }}
                </button>

                <div v-if="res && !res.ok" class="alert alert-danger mt-3" role="alert">
                    {{ $t(res.msg) }}
                </div>
            </form>
        </div>
    </div>
</template>

<script>
import axios from "axios";

export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            token: "",
            res: null,
            tokenRequired: false,
            oidcInfo: null,
        };
    },

    computed: {
        oidcEnabled() {
            if (this.$root.info?.oidc && typeof this.$root.info?.oidc?.enabled === "boolean") {
                return this.$root.info.oidc.enabled;
            }

            if (this.oidcInfo && typeof this.oidcInfo.enabled === "boolean") {
                return this.oidcInfo.enabled;
            }

            return false;
        },
        oidcButtonLabel() {
            const customLabel = this.$root.info?.oidc?.buttonLabel;
            if (customLabel && typeof customLabel === "string" && customLabel.trim().length > 0) {
                return customLabel;
            }

            if (this.oidcInfo?.buttonLabel && this.oidcInfo.buttonLabel.trim().length > 0) {
                return this.oidcInfo.buttonLabel;
            }

            return this.$t("Sign in with OIDC");
        },
    },

    watch: {
        tokenRequired(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    this.$refs.otpInput?.focus();
                });
            }
        }
    },

    mounted() {
        document.title += " - Login";
        this.loadOIDCInfo();
    },

    unmounted() {
        document.title = document.title.replace(" - Login", "");
    },

    methods: {
        /**
         * Submit the user details and attempt to log in
         * @returns {void}
         */
        submit() {
            this.processing = true;

            this.$root.login(this.username, this.password, this.token, (res) => {
                this.processing = false;

                if (res.tokenRequired) {
                    this.tokenRequired = true;
                } else {
                    this.res = res;
                }
            });
        },

        startOIDCLogin() {
            const currentPath = this.$route?.fullPath || "/dashboard";
            const params = new URLSearchParams();

            if (typeof currentPath === "string" && currentPath.startsWith("/")) {
                params.set("returnTo", currentPath);
            }

            const target = params.toString() ? `/auth/oidc/login?${params.toString()}` : "/auth/oidc/login";
            window.location.assign(target);
        },

        async loadOIDCInfo() {
            try {
                const response = await axios.get("/auth/oidc/info");

                if (response.data?.ok) {
                    this.oidcInfo = {
                        enabled: !!response.data.enabled,
                        buttonLabel: response.data.buttonLabel || "",
                        tokenEndpointAuthMethod: response.data.tokenEndpointAuthMethod || "auto",
                    };
                } else {
                    this.oidcInfo = {
                        enabled: false,
                        buttonLabel: "",
                        tokenEndpointAuthMethod: "auto",
                    };
                }
            } catch (error) {
                this.oidcInfo = {
                    enabled: false,
                    buttonLabel: "",
                    tokenEndpointAuthMethod: "auto",
                };
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.form-container {
    display: flex;
    align-items: center;
    padding-top: 40px;
    padding-bottom: 40px;
}

.form-floating {
    > label {
        padding-left: 1.3rem;
    }

    > .form-control {
        padding-left: 1.3rem;
    }
}

.form {
    width: 100%;
    max-width: 330px;
    padding: 15px;
    margin: auto;
    text-align: center;
}
</style>
