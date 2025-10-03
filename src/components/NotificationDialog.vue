<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            {{ $t("Setup Notification") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="notification-type" class="form-label">{{ $t("Notification Type") }}</label>
                            <select id="notification-type" v-model="notification.type" class="form-select">
                                <option v-for="(name, type) in notificationNameList.regularList" :key="type" :value="type">{{ name }}</option>
                                <optgroup :label="$t('notificationRegional')">
                                    <option v-for="(name, type) in notificationNameList.regionalList" :key="type" :value="type">{{ name }}</option>
                                </optgroup>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="notification-name" class="form-label">{{ $t("Friendly Name") }}</label>
                            <input id="notification-name" v-model="notification.name" type="text" class="form-control" required>
                        </div>

                        <!-- form body -->
                        <component :is="currentForm" />

                        <div class="mb-3 mt-4">
                            <hr class="dropdown-divider mb-4">

                            <div class="form-check form-switch">
                                <input v-model="notification.isDefault" class="form-check-input" type="checkbox">
                                <label class="form-check-label">{{ $t("Default enabled") }}</label>
                            </div>
                            <div class="form-text">
                                {{ $t("enableDefaultNotificationDescription") }}
                            </div>

                            <br>

                            <div class="form-check form-switch">
                                <input v-model="notification.applyExisting" class="form-check-input" type="checkbox">
                                <label class="form-check-label">{{ $t("Apply on all existing monitors") }}</label>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button v-if="id" type="button" class="btn btn-danger" :disabled="processing" @click="deleteConfirm">
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

    <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteNotification">
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
    emits: [ "added" ],
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
            }
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
            let regularList = {
                "alerta": "Alerta",
                "AlertNow": "AlertNow",
                "apprise": this.$t("apprise"),
                "Bark": "Bark",
                "Bitrix24": "Bitrix24",
                "clicksendsms": "ClickSend SMS",
                "CallMeBot": "CallMeBot (WhatsApp, Telegram Call, Facebook Messanger)",
                "discord": "Discord",
                "Elks": "46elks",
                "GoogleChat": "Google Chat (Google Workspace)",
                "gorush": "Gorush",
                "gotify": "Gotify",
                "GrafanaOncall": "Grafana Oncall",
                "HeiiOnCall": "Heii On-Call",
                "HomeAssistant": "Home Assistant",
                "Keep": "Keep",
                "Kook": "Kook",
                "line": "LINE Messenger",
                "LineNotify": "LINE Notify",
                "lunasea": "LunaSea",
                "matrix": "Matrix",
                "mattermost": "Mattermost",
                "nostr": "Nostr",
                "ntfy": "Ntfy",
                "octopush": "Octopush",
                "OneChat": "OneChat",
                "OneBot": "OneBot",
                "Onesender": "Onesender",
                "Opsgenie": "Opsgenie",
                "PagerDuty": "PagerDuty",
                "PagerTree": "PagerTree",
                "pumble": "Pumble",
                "pushbullet": "Pushbullet",
                "PushByTechulus": "Push by Techulus",
                "pushover": "Pushover",
                "pushy": "Pushy",
                "rocket.chat": "Rocket.Chat",
                "signal": "Signal",
                "SIGNL4": "SIGNL4",
                "slack": "Slack",
                "squadcast": "SquadCast",
                "SMSEagle": "SMSEagle",
                "SMSPartner": "SMS Partner",
                "smtp": this.$t("smtp"),
                "stackfield": "Stackfield",
                "teams": "Microsoft Teams",
                "telegram": "Telegram",
                "threema": "Threema",
                "twilio": "Twilio",
                "Splunk": "Splunk",
                "webhook": "Webhook",
                "GoAlert": "GoAlert",
                "ZohoCliq": "ZohoCliq",
                "SevenIO": "SevenIO",
                "whapi": "WhatsApp (Whapi)",
                "evolution": "WhatsApp (Evolution)",
                "waha": "WhatsApp (WAHA)",
                "gtxmessaging": "GtxMessaging",
                "Cellsynt": "Cellsynt",
                "SendGrid": "SendGrid",
                "Brevo": "Brevo",
                "notifery": "Notifery"
            };

            // Put notifications here if it's not supported in most regions or its documentation is not in English
            let regionalList = {
                "AliyunSMS": "AliyunSMS (阿里云短信服务)",
                "DingDing": "DingDing (钉钉自定义机器人)",
                "Feishu": "Feishu (飞书)",
                "FlashDuty": "FlashDuty (快猫星云)",
                "FreeMobile": "FreeMobile (mobile.free.fr)",
                "PushDeer": "PushDeer",
                "promosms": "PromoSMS",
                "serwersms": "SerwerSMS.pl",
                "SMSManager": "SmsManager (smsmanager.cz)",
                "WeCom": "WeCom (企业微信群机器人)",
                "ServerChan": "ServerChan (Server酱)",
                "PushPlus": "PushPlus (推送加)",
                "SpugPush": "SpugPush（Spug推送助手）",
                "smsc": "SMSC",
                "WPush": "WPush(wpush.cn)",
                "YZJ": "YZJ (云之家自定义机器人)",
                "SMSPlanet": "SMSPlanet.pl"
            };

            // Sort by notification name
            // No idea how, but it works
            // https://stackoverflow.com/questions/1069666/sorting-object-property-by-values
            let sort = (list2) => {
                return Object.entries(list2)
                    .sort(([ , a ], [ , b ]) => a.localeCompare(b))
                    .reduce((r, [ k, v ]) => ({
                        ...r,
                        [k]: v
                    }), {});
            };

            return {
                regularList: sort(regularList),
                regionalList: sort(regionalList),
            };
        },

        notificationFullNameList() {
            let list = {};
            for (let [ key, value ] of Object.entries(this.notificationNameList.regularList)) {
                list[key] = value;
            }
            for (let [ key, value ] of Object.entries(this.notificationNameList.regionalList)) {
                list[key] = value;
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

            if (! this.notification.name || this.notification.name === oldName) {
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
                    if (! this.id) {
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
                    number: index++
                });
            } while (this.$root.notificationList.find(it => it.name === name));
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
        }
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dark {
    .modal-dialog .form-text, .modal-dialog p {
        color: $dark-font-color;
    }
}
</style>
