<template>
    <div class="my-4">
        <h5 class="settings-subheading">{{ $t("SAML / SSO") }}</h5>

        <div class="mb-3 form-check form-switch">
            <input
                id="saml-enabled"
                v-model="settings.samlEnabled"
                class="form-check-input"
                type="checkbox"
                role="switch"
            />
            <label class="form-check-label" for="saml-enabled">{{ $t("Enable SAML SSO") }}</label>
        </div>

        <template v-if="settings.samlEnabled">
            <div class="mb-3">
                <label class="form-label">{{ $t("IdP Metadata XML") }}</label>
                <div class="d-flex align-items-center gap-2">
                    <label class="btn btn-outline-secondary btn-sm mb-0" style="cursor:pointer;">
                        <font-awesome-icon icon="upload" class="me-1" />
                        {{ $t("Upload Metadata XML") }}
                        <input ref="metadataFile" type="file" accept=".xml,application/xml,text/xml" class="d-none" @change="onMetadataFileChange" />
                    </label>
                    <span v-if="metadataFileName" class="small text-muted">{{ metadataFileName }}</span>
                </div>
                <div class="form-text">{{ $t("Upload your IdP metadata XML to auto-fill the fields below.") }}</div>
                <div v-if="metadataParseError" class="text-danger small mt-1">{{ metadataParseError }}</div>
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("IdP SSO URL") }}</label>
                <input v-model="settings.samlEntryPoint" type="url" class="form-control" placeholder="https://idp.example.com/sso/saml" />
                <div class="form-text">{{ $t("The SAML Single Sign-On URL from your identity provider.") }}</div>
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("IdP Certificate (X.509)") }}</label>
                <textarea
                    v-model="settings.samlCert"
                    class="form-control font-monospace"
                    rows="6"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                ></textarea>
                <div class="form-text">{{ $t("Paste the X.509 certificate from your identity provider.") }}</div>
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("Username Attribute") }}</label>
                <input v-model="settings.samlUsernameAttr" type="text" class="form-control" placeholder="nameID" />
                <div class="form-text">{{ $t("SAML attribute to use as the username. Leave blank to use NameID.") }}</div>
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("SP Entity ID / Issuer") }} <span class="text-muted">({{ $t("optional") }})</span></label>
                <input v-model="settings.samlIssuer" type="text" class="form-control" :placeholder="spEntityIdPlaceholder" />
                <div class="form-text">{{ $t("Leave blank to auto-derive from the callback URL.") }}</div>
            </div>

            <div class="mb-3">
                <label class="form-label">{{ $t("ACS Callback URL") }} <span class="text-muted">({{ $t("optional override") }})</span></label>
                <input v-model="settings.samlCallbackUrl" type="url" class="form-control" :placeholder="acsUrlPlaceholder" />
                <div class="form-text">{{ $t("The URL your IdP posts the SAML response to. Auto-derived from your server URL if blank.") }}</div>
            </div>

            <div class="mb-4 p-3 rounded" style="border: 1px solid rgba(0,0,0,0.12);">
                <div class="fw-bold small mb-2">{{ $t("Configure your IdP with these values") }}</div>
                <div class="mb-1 small">
                    <span class="text-muted">{{ $t("ACS URL") }}:</span>
                    <code class="ms-2">{{ acsUrlPlaceholder }}</code>
                </div>
                <div class="mb-2 small">
                    <span class="text-muted">{{ $t("Entity ID") }}:</span>
                    <code class="ms-2">{{ settings.samlIssuer || spEntityIdPlaceholder }}</code>
                </div>
                <a :href="metadataUrl" target="_blank" class="btn btn-sm btn-outline-secondary">
                    <font-awesome-icon icon="download" />
                    {{ $t("Download SP Metadata XML") }}
                </a>
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
            metadataFileName: "",
            metadataParseError: "",
            settings: {
                samlEnabled: false,
                samlEntryPoint: "",
                samlCert: "",
                samlUsernameAttr: "",
                samlIssuer: "",
                samlCallbackUrl: "",
            },
        };
    },

    computed: {
        acsUrlPlaceholder() {
            return `${window.location.origin}/auth/saml/callback`;
        },
        spEntityIdPlaceholder() {
            return window.location.origin;
        },
        metadataUrl() {
            return "/auth/saml/metadata";
        },
    },

    mounted() {
        this.load();
    },

    methods: {
        load() {
            this.$root.getSocket().emit("getSAMLSettings", (res) => {
                if (res.ok) {
                    const s = res.data;
                    this.settings.samlEnabled = !!s.samlEnabled;
                    this.settings.samlEntryPoint = s.samlEntryPoint || "";
                    this.settings.samlCert = s.samlCert || "";
                    this.settings.samlUsernameAttr = s.samlUsernameAttr || "";
                    this.settings.samlIssuer = s.samlIssuer || "";
                    this.settings.samlCallbackUrl = s.samlCallbackUrl || "";
                }
            });
        },

        onMetadataFileChange(event) {
            const file = event.target.files[0];
            if (!file) {
                return;
            }
            this.metadataFileName = file.name;
            this.metadataParseError = "";
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(e.target.result, "application/xml");
                    if (doc.querySelector("parsererror")) {
                        throw new Error("Invalid XML");
                    }

                    // SSO URL — prefer HTTP-POST binding, fall back to HTTP-Redirect
                    const ns = "urn:oasis:names:tc:SAML:2.0:metadata";
                    const bindingPost = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";
                    const bindingRedirect = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";
                    let ssoEl = doc.querySelector(`SingleSignOnService[Binding="${bindingPost}"]`)
                        || doc.querySelector(`SingleSignOnService[Binding="${bindingRedirect}"]`)
                        || doc.querySelector("SingleSignOnService");
                    if (ssoEl) {
                        this.settings.samlEntryPoint = ssoEl.getAttribute("Location") || this.settings.samlEntryPoint;
                    }

                    // Entity ID
                    const entityDescriptor = doc.querySelector("EntityDescriptor");
                    if (entityDescriptor) {
                        const entityId = entityDescriptor.getAttribute("entityID");
                        if (entityId && !this.settings.samlIssuer) {
                            // Don't overwrite a manually set issuer; just a hint
                        }
                    }

                    // Certificate — first X509Certificate inside KeyDescriptor use="signing", or any
                    let certEl = doc.querySelector(`KeyDescriptor[use="signing"] X509Certificate`)
                        || doc.querySelector("X509Certificate");
                    if (certEl) {
                        const raw = certEl.textContent.replace(/\s+/g, "");
                        this.settings.samlCert = `-----BEGIN CERTIFICATE-----\n${raw.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----`;
                    }
                } catch {
                    this.metadataParseError = this.$t("Failed to parse metadata XML. Please check the file and try again.");
                }
                // Reset so the same file can be re-uploaded if needed
                this.$refs.metadataFile.value = "";
            };
            reader.readAsText(file);
        },

        save() {
            this.saving = true;
            this.$root.getSocket().emit("setSAMLSettings", this.settings, (res) => {
                this.saving = false;
                this.$root.toastRes(res);
            });
        },
    },
};
</script>
