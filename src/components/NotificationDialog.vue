<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            {{ $t("Setup Notification") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('Close')" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="notification-type" class="form-label">{{ $t("Notification Type") }}</label>
                            <select id="notification-type" v-model="notification.type" class="form-select">
                                <optgroup :label="$t('notificationUniversal')">
                                    <option
                                        v-for="(name, type) in notificationNameList.universal"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                                <optgroup :label="$t('notificationChatPlatforms')">
                                    <option
                                        v-for="(name, type) in notificationNameList.chatPlatforms"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                                <optgroup :label="$t('notificationPushServices')">
                                    <option
                                        v-for="(name, type) in notificationNameList.pushServices"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                                <optgroup :label="$t('notificationSmsServices')">
                                    <option
                                        v-for="(name, type) in notificationNameList.smsServices"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                                <optgroup :label="$t('notificationEmail')">
                                    <option
                                        v-for="(name, type) in notificationNameList.email"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                                <optgroup :label="$t('notificationIncidentManagement')">
                                    <option
                                        v-for="(name, type) in notificationNameList.incidentManagement"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                                <optgroup :label="$t('notificationHomeAutomation')">
                                    <option
                                        v-for="(name, type) in notificationNameList.homeAutomation"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                                <optgroup :label="$t('notificationOther')">
                                    <option
                                        v-for="(name, type) in notificationNameList.other"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                                <optgroup :label="$t('notificationRegional')">
                                    <option
                                        v-for="(name, type) in notificationNameList.regional"
                                        :key="type"
                                        :value="type"
                                    >
                                        {{ name }}
                                    </option>
                                </optgroup>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="notification-name" class="form-label">{{ $t("Friendly Name") }}</label>
                            <input
                                id="notification-name"
                                v-model="notification.name"
                                type="text"
                                class="form-control"
                                required
                            />
                        </div>

                        <!-- form body -->
                        <component :is="currentForm" />

                        <div class="mb-3 mt-4">
                            <hr class="dropdown-divider mb-4" />

                            <div class="form-check form-switch">
                                <input v-model="notification.isDefault" class="form-check-input" type="checkbox" />
                                <label class="form-check-label">{{ $t("Default enabled") }}</label>
                            </div>
                            <div class="form-text">
                                {{ $t("enableDefaultNotificationDescription") }}
                            </div>

                            <br />

                            <div class="form-check form-switch">
                                <input v-model="notification.applyExisting" class="form-check-input" type="checkbox" />
                                <label class="form-check-label">{{ $t("Apply on all existing monitors") }}</label>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button
                            v-if="id"
                            type="button"
                            class="btn btn-danger"
                            :disabled="processing"
                            @click="deleteConfirm"
                        >
                            {{ $t("Delete") }}
                        </button>
                        <button type="button" class="btn btn-warning" :disabled="processing" @click="test">
                            {{ $t("Test") }}
                        </button>
                        <button type="submit" class="btn btn-primary" :disabled="processing">
                            <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>

    <Confirm
        ref="confirmDelete"
        btn-style="btn-danger"
        :yes-text="$t('Yes')"
        :no-text="$t('No')"
        @yes="deleteNotification"
    >
        {{ $t("deleteNotificationMsg") }}
    </Confirm>
</template>

<script>
import { Modal } from "bootstrap";

import Confirm from "./Confirm.vue";
import NotificationFormList from "./notifications";

export default {
    components: {
        Confirm,
    },
    props: {},
    emits: ["added"],
    data() {
        return {
            model: null,
            processing: false,
            id: null,
            notificationTypes: Object.keys(NotificationFormList).sort((a, b) => {
                return a.toLowerCase().localeCompare(b.toLowerCase());
            }),
            notification: {
                name: "",
                /** @type { null | keyof NotificationFormList } */
                type: null,
                isDefault: false,
                // Do not set default value here, please scroll to show()
            },
        };
    },

    computed: {
        currentForm() {
            if (!this.notification.type) {
                return null;
            }
            return NotificationFormList[this.notification.type];
        },

        notificationNameList() {
            // Universal - Adapters and multi-service wrapper libraries
            let universal = {
                apprise: this.$t("apprise"),
                webhook: "Webhook",
            };

            // Chat Platforms - Messaging apps and team communication tools
            let chatPlatforms = {
                bale: "Bale",
                Bitrix24: "Bitrix24",
                discord: "Discord",
                GoogleChat: "Google Chat (Google Workspace)",
                gorush: "Gorush",
                gotify: "Gotify",
                GrafanaOncall: "Grafana Oncall",
                HaloPSA: "Halo PSA",
                HeiiOnCall: "Heii On-Call",
                HomeAssistant: "Home Assistant",
                Keep: "Keep",
                Kook: "Kook",
                line: "LINE Messenger",
                matrix: "Matrix",
                mattermost: "Mattermost",
                nextcloudtalk: "Nextcloud Talk",
                nostr: "Nostr",
                OneChat: "OneChat",
                OneBot: "OneBot",
                pumble: "Pumble",
                "rocket.chat": "Rocket.Chat",
                signal: "Signal",
                slack: "Slack",
                stackfield: "Stackfield",
                teams: "Microsoft Teams",
                telegram: "Telegram",
                threema: "Threema",
                ZohoCliq: "ZohoCliq",
                CallMeBot: "CallMeBot (WhatsApp, Telegram Call, Facebook Messenger)",
                whapi: "WhatsApp (Whapi)",
                evolution: "WhatsApp (Evolution)",
                waha: "WhatsApp (WAHA)",
            };

            // Push Services - Push notification services
            let pushServices = {
                Bark: "Bark",
                gorush: "Gorush",
                gotify: "Gotify",
                lunasea: "LunaSea",
                notifery: "Notifery",
                ntfy: "Ntfy",
                pushbullet: "Pushbullet",
                PushByTechulus: "Push by Techulus",
                pushover: "Pushover",
                pushy: "Pushy",
                Webpush: "Webpush",
            };

            // SMS Services - SMS and voice call providers
            let smsServices = {
                clicksendsms: "ClickSend SMS",
                Elks: "46elks",
                Cellsynt: "Cellsynt",
                gtxmessaging: "GtxMessaging",
                octopush: "Octopush",
                Onesender: "Onesender",
                SevenIO: "SevenIO",
                SMSEagle: "SMSEagle",
                SMSPartner: "SMS Partner",
                twilio: "Twilio",
            };

            // Email - Email services
            let email = {
                Brevo: "Brevo",
                Resend: "Resend",
                SendGrid: "SendGrid",
                smtp: this.$t("smtp"),
            };

            // Incident Management - On-call and alerting platforms
            let incidentManagement = {
                alerta: "Alerta",
                AlertNow: "AlertNow",
                GoAlert: "GoAlert",
                GrafanaOncall: "Grafana Oncall",
                HeiiOnCall: "Heii On-Call",
                Keep: "Keep",
                Opsgenie: "Opsgenie",
                PagerDuty: "PagerDuty",
                PagerTree: "PagerTree",
                SIGNL4: "SIGNL4",
                Splunk: "Splunk",
                squadcast: "SquadCast",
            };

            // Home Automation - Smart home and IoT platforms
            let homeAutomation = {
                HomeAssistant: "Home Assistant",
            };

            // Other Integrations
            let other = {};

            // Regional - Not supported in most regions or documentation is not in English
            let regional = {
                AliyunSMS: "AliyunSMS (阿里云短信服务)",
                DingDing: "DingDing (钉钉自定义机器人)",
                Feishu: "Feishu (飞书)",
                FlashDuty: "FlashDuty (快猫星云)",
                FreeMobile: "FreeMobile (mobile.free.fr)",
                PushDeer: "PushDeer",
                promosms: "PromoSMS",
                serwersms: "SerwerSMS.pl",
                SMSManager: "SmsManager (smsmanager.cz)",
                WeCom: "WeCom (企业微信群机器人)",
                ServerChan: "ServerChan (Server酱)",
                PushPlus: "PushPlus (推送加)",
                SpugPush: "SpugPush（Spug推送助手）",
                smsc: "SMSC",
                smsir: "SMS.IR",
                WPush: "WPush(wpush.cn)",
                YZJ: "YZJ (云之家自定义机器人)",
                SMSPlanet: "SMSPlanet.pl",
            };

            // Sort by notification name alphabetically
            // https://stackoverflow.com/questions/1069666/sorting-object-property-by-values
            let sort = (list2) => {
                return Object.entries(list2)
                    .sort(([, a], [, b]) => a.localeCompare(b))
                    .reduce(
                        (r, [k, v]) => ({
                            ...r,
                            [k]: v,
                        }),
                        {}
                    );
            };

            return {
                universal: sort(universal),
                chatPlatforms: sort(chatPlatforms),
                pushServices: sort(pushServices),
                smsServices: sort(smsServices),
                email: sort(email),
                incidentManagement: sort(incidentManagement),
                homeAutomation: sort(homeAutomation),
                other: sort(other),
                regional: sort(regional),
            };
        },

        notificationFullNameList() {
            let list = {};
            // Combine all categories into a single list
            for (let category of Object.values(this.notificationNameList)) {
                for (let [key, value] of Object.entries(category)) {
                    list[key] = value;
                }
            }
            return list;
        },
    },

    watch: {
        "notification.type"(to, from) {
            let oldName;
            if (from) {
                oldName = this.getUniqueDefaultName(from);
            } else {
                oldName = "";
            }

            if (!this.notification.name || this.notification.name === oldName) {
                this.notification.name = this.getUniqueDefaultName(to);
            }
        },
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    beforeUnmount() {
        this.cleanupModal();
    },
    methods: {
        /**
         * Show dialog to confirm deletion
         * @returns {void}
         */
        deleteConfirm() {
            this.modal.hide();
            this.$refs.confirmDelete.show();
        },

        /**
         * Show settings for specified notification
         * @param {number} notificationID ID of notification to show
         * @returns {void}
         */
        show(notificationID) {
            if (notificationID) {
                this.id = notificationID;

                for (let n of this.$root.notificationList) {
                    if (n.id === notificationID) {
                        this.notification = JSON.parse(n.config);
                        break;
                    }
                }
            } else {
                this.id = null;
                this.notification = {
                    name: "",
                    type: "telegram",
                    isDefault: false,
                };
            }

            this.modal.show();
        },

        /**
         * Submit the form to the server
         * @returns {void}
         */
        submit() {
            this.processing = true;
            this.$root.getSocket().emit("addNotification", this.notification, this.id, (res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok) {
                    this.modal.hide();

                    // Emit added event, doesn't emit edit.
                    if (!this.id) {
                        this.$emit("added", res.id);
                    }
                }
            });
        },

        /**
         * Test the notification endpoint
         * @returns {void}
         */
        test() {
            this.processing = true;
            this.$root.getSocket().emit("testNotification", this.notification, (res) => {
                this.$root.toastRes(res);
                this.processing = false;
            });
        },

        /**
         * Delete the notification endpoint
         * @returns {void}
         */
        deleteNotification() {
            this.processing = true;
            this.$root.getSocket().emit("deleteNotification", this.id, (res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok) {
                    this.modal.hide();
                }
            });
        },
        /**
         * Get a unique default name for the notification
         * @param {keyof NotificationFormList} notificationKey
         * Notification to retrieve
         * @returns {string} Default name
         */
        getUniqueDefaultName(notificationKey) {
            let index = 1;
            let name = "";
            do {
                name = this.$t("defaultNotificationName", {
                    notification: this.notificationFullNameList[notificationKey].replace(/\(.+\)/, "").trim(),
                    number: index++,
                });
            } while (this.$root.notificationList.find((it) => it.name === name));
            return name;
        },

        /**
         * Clean up modal and restore scroll behavior
         * @returns {void}
         */
        cleanupModal() {
            if (this.modal) {
                try {
                    this.modal.hide();
                } catch (e) {
                    console.warn("Modal hide failed:", e);
                }
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dark {
    .modal-dialog .form-text,
    .modal-dialog p {
        color: $dark-font-color;
    }
}
</style>
