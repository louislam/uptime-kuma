<template>
    <div ref="modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body">
                    <div v-if="monitor?.type === 'http'">
                        <textarea id="curl-debug" v-model="curlCommand" class="form-control mb-3" readonly wrap="off"></textarea>
                        <button
                            id="debug-copy-btn" class="btn btn-outline-primary position-absolute top-0 end-0 mt-3 me-3 border-0"
                            type="button" @click.stop="copyToClipboard"
                        >
                            <font-awesome-icon icon="copy" />
                        </button>
                        <i18n-t keypath="CurlDebugInfo" tag="p" class="form-text">
                            <template #newiline>
                                <br>
                            </template>
                            <template #firewalls>
                                <a href="https://xkcd.com/2259/" target="_blank">{{ $t('firewalls') }}</a>
                            </template>
                            <template #dns_resolvers>
                                <a
                                    href="https://www.reddit.com/r/sysadmin/comments/rxho93/thank_you_for_the_running_its_always_dns_joke_its/"
                                    target="_blank"
                                >{{ $t('dns resolvers') }}</a>
                            </template>
                            <template #docker_networks>
                                <a href="https://youtu.be/bKFMS5C4CG0" target="_blank">{{ $t('docker networks') }}</a>
                            </template>
                        </i18n-t>
                        <div
                            v-if="monitor.authMethod === 'oauth2-cc'" class="alert alert-warning d-flex align-items-center gap-2"
                            role="alert"
                        >
                            <div role="img" aria-label="Warning:">⚠️</div>
                            <i18n-t keypath="CurlDebugInfoOAuth2CCUnsupported" tag="div">
                                <template #curl>
                                    <code>curl</code>
                                </template>
                                <template #newline>
                                    <br>
                                </template>
                                <template #oauth2_bearer>
                                    <code>--oauth2-bearer TOKEN</code>
                                </template>
                            </i18n-t>
                        </div>
                        <div v-if="monitor.proxyId" class="alert alert-warning d-flex align-items-center gap-2" role="alert">
                            <div role="img" aria-label="Warning:">⚠️</div>
                            <i18n-t keypath="CurlDebugInfoProxiesUnsupported" tag="div">
                                <template #curl>
                                    <code>curl</code>
                                </template>
                            </i18n-t>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<script>
import { Modal } from "bootstrap";
import { version } from "../../package.json";
import { useToast } from "vue-toastification";
const toast = useToast();
export default {
    name: "DebugMonitor",
    props: {
        /** Monitor this represents */
        monitor: {
            type: Object,
            default: null,
        },
    },
    data() {
        return {
            modal: null,
        };
    },
    computed: {
        curlCommand() {
            if (this.monitor === null) {
                return "";
            }
            let method = this.monitor.method;
            if ([ "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS" ].indexOf(method) === -1) {
                // set to a custom value => could lead to injections
                method = this.escapeShell(method);
            }
            const command = [ "curl", "--verbose", "--head", "--request", method, "\\\n" ];
            command.push("--user-agent", `'Uptime-Kuma/${version}'`, "\\\n");
            if (this.monitor.ignoreTls) {
                command.push("--insecure", "\\\n");
            }
            if (this.monitor.headers) {
                try {
                    for (const [ key, value ] of Object.entries(JSON.parse(this.monitor.headers))) {
                        command.push("--header", `'${this.escapeShellNoQuotes(key)}: ${this.escapeShellNoQuotes(value)}'`, "\\\n");
                    }
                } catch (e) {
                    command.push("--header", this.escapeShell(this.monitor.headers), "\\\n");
                }
            }
            if (this.monitor.authMethod === "basic") {
                command.push("--basic", "--user", `'${this.escapeShellNoQuotes(this.monitor.basic_auth_user)}:${this.escapeShellNoQuotes(this.monitor.basic_auth_pass)}'`, "\\\n");
            } else if (this.monitor.authMethod === "mtls") {
                command.push("--cacert", this.escapeShell(this.monitor.tlsCa), "\\\n");
                command.push("--key", this.escapeShell(this.monitor.tlsKey), "\\\n");
                command.push( "--cert", this.escapeShell(this.monitor.tlsCert), "\\\n");
            } else if (this.monitor.authMethod === "ntlm") {
                let domain = "";
                if (this.monitor.authDomain) {
                    domain = `${this.monitor.authDomain}/`;
                }
                command.push("--ntlm", "--user", `'${this.escapeShellNoQuotes(domain)}${this.escapeShellNoQuotes(this.monitor.basic_auth_user)}:${this.escapeShellNoQuotes(this.monitor.basic_auth_pass)}'`, "\\\n");
            }
            if (this.monitor.body && this.monitor.httpBodyEncoding === "json") {
                let json = "";
                try {
                    // trying to parse the supplied data as json to trim whitespace
                    json = JSON.stringify(JSON.parse(this.monitor.body));
                } catch (e) {
                    json = this.monitor.body;
                }
                command.push("--header", "'Content-Type: application/json'", "\\\n");
                command.push("--data", this.escapeShell(json), "\\\n");
            } else if (this.monitor.body && this.monitor.httpBodyEncoding === "xml") {
                command.push("--headers", "'Content-Type: application/xml'", "\\\n");
                command.push("--data", this.escapeShell(this.monitor.body), "\\\n");
            }
            if (this.monitor.maxredirects) {
                command.push("--location", "--max-redirs", this.escapeShell(this.monitor.maxredirects), "\\\n");
            }
            if (this.monitor.timeout) {
                command.push("--max-time", this.escapeShell(this.monitor.timeout), "\\\n");
            }
            if (this.monitor.maxretries) {
                command.push("--retry", this.escapeShell(this.monitor.maxretries), "\\\n");
            }
            command.push("--url", this.escapeShell(this.monitor.url));
            return command.join(" ");
        },
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {
        /**
         * Show the dialog
         * @returns {void}
         */
        show() {
            this.modal.show();
        },
        /**
         * Escape a string for use in a shell
         * @param {string|number} s string to escape
         * @returns {string} escaped, quoted string
         */
        escapeShell(s) {
            if (typeof s == "number") {
                return s.toString();
            }
            return "'" + this.escapeShellNoQuotes(s) + "'";
        },
        /**
         * Escape a string for use in a shell
         * @param {string} s string to escape
         * @returns {string} escaped string
         */
        escapeShellNoQuotes(s) {
            return s.replace(/(['"$`\\])/g, "\\$1");
        },
        /**
         * Copies a value to the clipboard and shows toasts with the success/error
         * @returns {void}
         */
        async copyToClipboard() {
            try {
                await navigator.clipboard.writeText(this.curlCommand);
                toast.success(this.$t("CopyToClipboardSuccess"));
            } catch (err) {
                toast.error(this.$t("CopyToClipboardError", { error: err.message }));
            }
        },
    }
};
</script>
<style lang="scss" scoped>
@import "../assets/vars";

textarea {
    min-height: 200px;
}

#curl-debug {
    font-family: monospace;
    overflow: auto;
}
</style>
