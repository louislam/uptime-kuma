<template>
    <span class="monitor-type-icon" :title="title" aria-hidden="true">
        <img v-if="showFavicon" :src="faviconUrl" class="monitor-type-favicon" alt="" @error="onFaviconError" />
        <font-awesome-icon v-else :icon="iconDefinition" class="monitor-type-symbol" />
    </span>
</template>

<script>
export default {
    props: {
        /** Monitor to render an icon for */
        monitor: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            faviconFailed: false,
        };
    },
    computed: {
        faviconUrl() {
            if (!this.monitor?.url) {
                return "";
            }

            return `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(this.monitor.url)}`;
        },

        showFavicon() {
            return (this.isHttpMonitor || this.isRealBrowserMonitor) && this.faviconUrl !== "" && !this.faviconFailed;
        },

        iconDefinition() {
            if (this.isHttpMonitor) {
                return "globe";
            }

            if (this.isKeywordMonitor || this.isGrpcKeywordMonitor || this.isJsonQueryMonitor) {
                return "code";
            }

            if (this.isPortMonitor) {
                return "link";
            }

            if (this.isPingMonitor) {
                return "heartbeat";
            }

            if (this.isDnsMonitor) {
                return "cloud";
            }

            if (this.isDockerMonitor) {
                return ["fab", "docker"];
            }

            if (this.isSystemMonitor) {
                return "cogs";
            }

            if (this.isNodeMonitor) {
                return ["fab", "node-js"];
            }

            if (this.isRealBrowserMonitor) {
                return "globe";
            }

            if (this.isGroupMonitor) {
                return "folder";
            }

            if (this.isPushMonitor) {
                return "paper-plane";
            }

            if (this.isManualMonitor) {
                return "hand-point-up";
            }

            if (this.isKafkaMonitor || this.isRabbitMqMonitor) {
                return "stream";
            }

            if (this.isMqttMonitor) {
                return "broadcast-tower";
            }

            if (this.isNtpMonitor) {
                return "clock";
            }

            if (this.isSipOptionsMonitor) {
                return "phone";
            }

            if (this.isSmtpMonitor) {
                return "envelope";
            }

            if (this.isSnmpMonitor) {
                return "network-wired";
            }

            if (this.isDatabaseMonitor) {
                return "database";
            }

            if (this.isGameMonitor) {
                return "gamepad";
            }

            if (this.isWebsocketMonitor) {
                return "link";
            }

            if (this.isTailscalePingMonitor) {
                return "heartbeat";
            }

            return "question-circle";
        },

        title() {
            if (this.showFavicon) {
                return this.monitor.name;
            }

            if (this.isHttpMonitor) {
                return this.$t("HTTP(s)");
            }

            if (this.isKeywordMonitor) {
                return this.$t("HTTP(s) - Keyword");
            }

            if (this.isPingMonitor) {
                return this.$t("Ping");
            }

            if (this.isPortMonitor) {
                return this.$t("TCP Port");
            }

            if (this.isDnsMonitor) {
                return this.$t("DNS");
            }

            if (this.isDockerMonitor) {
                return this.$t("Docker");
            }

            if (this.isSystemMonitor) {
                return this.$t("System Service");
            }

            if (this.isNodeMonitor) {
                return this.$t("PM2");
            }

            if (this.isRealBrowserMonitor) {
                return this.$t("Real Browser");
            }

            if (this.isGroupMonitor) {
                return this.$t("Group");
            }

            if (this.isPushMonitor) {
                return this.$t("Push");
            }

            if (this.isManualMonitor) {
                return this.$t("Manual");
            }

            if (this.isGrpcKeywordMonitor) {
                return this.$t("gRPC(s) - Keyword");
            }

            if (this.isJsonQueryMonitor) {
                return this.$t("HTTP(s) - Json Query");
            }

            if (this.isKafkaMonitor) {
                return this.$t("Kafka Producer");
            }

            if (this.isMqttMonitor) {
                return this.$t("MQTT");
            }

            if (this.isNtpMonitor) {
                return this.$t("NTP");
            }

            if (this.isRabbitMqMonitor) {
                return this.$t("RabbitMQ");
            }

            if (this.isSipOptionsMonitor) {
                return this.$t("SIP Options");
            }

            if (this.isSmtpMonitor) {
                return this.$t("SMTP");
            }

            if (this.isSnmpMonitor) {
                return this.$t("SNMP");
            }

            if (this.isDatabaseMonitor) {
                return this.$t("Database");
            }

            if (this.isGameMonitor) {
                return this.$t("Game Server");
            }

            if (this.isWebsocketMonitor) {
                return this.$t("Websocket Upgrade");
            }

            if (this.isTailscalePingMonitor) {
                return this.$t("Tailscale Ping");
            }

            return this.$t("Monitor Type");
        },

        isHttpMonitor() {
            return this.monitor.type === "http" || this.isGlobalpingHttpMonitor;
        },

        isPingMonitor() {
            return this.monitor.type === "ping" || this.isGlobalpingPingMonitor || this.isTailscalePingMonitor;
        },

        isPortMonitor() {
            return this.monitor.type === "port";
        },

        isDockerMonitor() {
            return this.monitor.type === "docker";
        },

        isDnsMonitor() {
            return this.monitor.type === "dns" || this.isGlobalpingDnsMonitor;
        },

        isSystemMonitor() {
            return this.monitor.type === "system-service";
        },

        isNodeMonitor() {
            return this.monitor.type === "pm2";
        },

        isGroupMonitor() {
            return this.monitor.type === "group";
        },

        isRealBrowserMonitor() {
            return this.monitor.type === "real-browser";
        },

        isPushMonitor() {
            return this.monitor.type === "push";
        },

        isManualMonitor() {
            return this.monitor.type === "manual";
        },

        isKeywordMonitor() {
            return this.monitor.type === "keyword";
        },

        isGrpcKeywordMonitor() {
            return this.monitor.type === "grpc-keyword";
        },

        isJsonQueryMonitor() {
            return this.monitor.type === "json-query";
        },

        isKafkaMonitor() {
            return this.monitor.type === "kafka-producer";
        },

        isMqttMonitor() {
            return this.monitor.type === "mqtt";
        },

        isNtpMonitor() {
            return this.monitor.type === "ntp";
        },

        isRabbitMqMonitor() {
            return this.monitor.type === "rabbitmq";
        },

        isSipOptionsMonitor() {
            return this.monitor.type === "sip-options";
        },

        isSmtpMonitor() {
            return this.monitor.type === "smtp";
        },

        isSnmpMonitor() {
            return this.monitor.type === "snmp";
        },

        isDatabaseMonitor() {
            return (
                this.monitor.type === "sqlserver" ||
                this.monitor.type === "mongodb" ||
                this.monitor.type === "mysql" ||
                this.monitor.type === "oracledb" ||
                this.monitor.type === "postgres" ||
                this.monitor.type === "redis"
            );
        },

        isGameMonitor() {
            return this.monitor.type === "gamedig" || this.monitor.type === "steam";
        },

        isWebsocketMonitor() {
            return this.monitor.type === "websocket-upgrade";
        },

        isTailscalePingMonitor() {
            return this.monitor.type === "tailscale-ping";
        },

        isGlobalpingHttpMonitor() {
            return this.monitor.type === "globalping" && this.monitor.subtype === "http";
        },

        isGlobalpingPingMonitor() {
            return this.monitor.type === "globalping" && this.monitor.subtype === "ping";
        },

        isGlobalpingDnsMonitor() {
            return this.monitor.type === "globalping" && this.monitor.subtype === "dns";
        },
    },
    methods: {
        onFaviconError() {
            this.faviconFailed = true;
        },
    },
};
</script>

<style scoped>
.monitor-type-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    min-width: 18px;
    height: 18px;
    flex: 0 0 18px;
}

.monitor-type-favicon {
    width: 16px;
    height: 16px;
    border-radius: 3px;
}

.monitor-type-symbol {
    font-size: 0.9rem;
    color: #8a8a8a;
}
</style>
