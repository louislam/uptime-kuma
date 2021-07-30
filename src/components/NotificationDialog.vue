<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            Setup Notification
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="type" class="form-label">Notification Type</label>
                            <select id="type" v-model="notification.type" class="form-select">
                                <option value="telegram">
                                    Telegram
                                </option>
                                <option value="webhook">
                                    Webhook
                                </option>
                                <option value="smtp">
                                    Email (SMTP)
                                </option>
                                <option value="discord">
                                    Discord
                                </option>
                                <option value="signal">
                                    Signal
                                </option>
                                <option value="gotify">
                                    Gotify
                                </option>
                                <option value="slack">
                                    Slack
                                </option>
                                <option value="pushover">
                                    Pushover
                                </option>
                                <option value="apprise">
                                    Apprise (Support 50+ Notification services)
                                </option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="name" class="form-label">Friendly Name</label>
                            <input id="name" v-model="notification.name" type="text" class="form-control" required>
                        </div>

                        <template v-if="notification.type === 'telegram'">
                            <div class="mb-3">
                                <label for="telegram-bot-token" class="form-label">Bot Token</label>
                                <input id="telegram-bot-token" v-model="notification.telegramBotToken" type="text" class="form-control" required>
                                <div class="form-text">
                                    You can get a token from <a href="https://t.me/BotFather" target="_blank">https://t.me/BotFather</a>.
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="telegram-chat-id" class="form-label">Chat ID</label>

                                <div class="input-group mb-3">
                                    <input id="telegram-chat-id" v-model="notification.telegramChatID" type="text" class="form-control" required>
                                    <button v-if="notification.telegramBotToken" class="btn btn-outline-secondary" type="button" @click="autoGetTelegramChatID">
                                        Auto Get
                                    </button>
                                </div>

                                <div class="form-text">
                                    Support Direct Chat / Group / Channel's Chat ID

                                    <p style="margin-top: 8px;">
                                        You can get your chat id by sending message to the bot and go to this url to view the chat_id:
                                    </p>

                                    <p style="margin-top: 8px;">
                                        <template v-if="notification.telegramBotToken">
                                            <a :href="telegramGetUpdatesURL" target="_blank" style="word-break: break-word;">{{ telegramGetUpdatesURL }}</a>
                                        </template>

                                        <template v-else>
                                            {{ telegramGetUpdatesURL }}
                                        </template>
                                    </p>
                                </div>
                            </div>
                        </template>

                        <template v-if="notification.type === 'webhook'">
                            <div class="mb-3">
                                <label for="webhook-url" class="form-label">Post URL</label>
                                <input id="webhook-url" v-model="notification.webhookURL" type="url" pattern="https?://.+" class="form-control" required>
                            </div>

                            <div class="mb-3">
                                <label for="webhook-content-type" class="form-label">Content Type</label>
                                <select id="webhook-content-type" v-model="notification.webhookContentType" class="form-select" required>
                                    <option value="json">
                                        application/json
                                    </option>
                                    <option value="form-data">
                                        multipart/form-data
                                    </option>
                                </select>

                                <div class="form-text">
                                    <p>"application/json" is good for any modern http servers such as express.js</p>
                                    <p>"multipart/form-data" is good for PHP, you just need to parse the json by <strong>json_decode($_POST['data'])</strong></p>
                                </div>
                            </div>
                        </template>

                        <template v-if="notification.type === 'smtp'">
                            <div class="mb-3">
                                <label for="hostname" class="form-label">Hostname</label>
                                <input id="hostname" v-model="notification.smtpHost" type="text" class="form-control" required>
                            </div>

                            <div class="mb-3">
                                <label for="port" class="form-label">Port</label>
                                <input id="port" v-model="notification.smtpPort" type="number" class="form-control" required min="0" max="65535" step="1">
                            </div>

                            <div class="mb-3">
                                <div class="form-check">
                                    <input id="secure" v-model="notification.smtpSecure" class="form-check-input" type="checkbox" value="">
                                    <label class="form-check-label" for="secure">
                                        Secure
                                    </label>
                                </div>
                                <div class="form-text">
                                    Generally, true for 465, false for other ports.
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="username" class="form-label">Username</label>
                                <input id="username" v-model="notification.smtpUsername" type="text" class="form-control" autocomplete="false">
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">Password</label>
                                <input id="password" v-model="notification.smtpPassword" type="password" class="form-control" autocomplete="false">
                            </div>

                            <div class="mb-3">
                                <label for="from-email" class="form-label">From Email</label>
                                <input id="from-email" v-model="notification.smtpFrom" type="email" class="form-control" required autocomplete="false">
                            </div>

                            <div class="mb-3">
                                <label for="to-email" class="form-label">To Email</label>
                                <input id="to-email" v-model="notification.smtpTo" type="email" class="form-control" required autocomplete="false">
                            </div>
                        </template>

                        <template v-if="notification.type === 'discord'">
                            <div class="mb-3">
                                <label for="discord-webhook-url" class="form-label">Discord Webhook URL</label>
                                <input id="discord-webhook-url" v-model="notification.discordWebhookUrl" type="text" class="form-control" required autocomplete="false">
                                <div class="form-text">
                                    You can get this by going to Server Settings -> Integrations -> Create Webhook
                                </div>
                            </div>
                        </template>

                        <template v-if="notification.type === 'signal'">
                            <div class="mb-3">
                                <label for="signal-url" class="form-label">Post URL</label>
                                <input id="signal-url" v-model="notification.signalURL" type="url" pattern="https?://.+" class="form-control" required>
                            </div>

                            <div class="mb-3">
                                <label for="signal-number" class="form-label">Number</label>
                                <input id="signal-number" v-model="notification.signalNumber" type="text" class="form-control" required>
                            </div>

                            <div class="mb-3">
                                <label for="signal-recipients" class="form-label">Recipients</label>
                                <input id="signal-recipients" v-model="notification.signalRecipients" type="text" class="form-control" required>

                                <div class="form-text">
                                    You need to have a signal client with REST API.

                                    <p style="margin-top: 8px;">
                                        You can check this url to view how to setup one:
                                    </p>

                                    <p style="margin-top: 8px;">
                                        <a href="https://github.com/bbernhard/signal-cli-rest-api" target="_blank">https://github.com/bbernhard/signal-cli-rest-api</a>
                                    </p>

                                    <p style="margin-top: 8px;">
                                        IMPORTANT: You cannot mix groups and numbers in recipients!
                                    </p>
                                </div>
                            </div>
                        </template>

                        <template v-if="notification.type === 'gotify'">
                            <div class="mb-3">
                                <label for="gotify-application-token" class="form-label">Application Token</label>
                                <input id="gotify-application-token" v-model="notification.gotifyapplicationToken" type="text" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label for="gotify-server-url" class="form-label">Server URL</label>
                                <div class="input-group mb-3">
                                    <input id="gotify-server-url" v-model="notification.gotifyserverurl" type="text" class="form-control" required>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="gotify-priority" class="form-label">Priority</label>
                                <input id="gotify-priority" v-model="notification.gotifyPriority" type="number" class="form-control" required min="0" max="10" step="1">
                            </div>
                        </template>

                        <template v-if="notification.type === 'slack'">
                            <div class="mb-3">
                                <label for="slack-webhook-url" class="form-label">Webhook URL<span style="color:red;"><sup>*</sup></span></label>
                                <input id="slack-webhook-url" v-model="notification.slackwebhookURL" type="text" class="form-control" required>
                                <label for="slack-username" class="form-label">Username</label>
                                <input id="slack-username" v-model="notification.slackusername" type="text" class="form-control">
                                <label for="slack-iconemo" class="form-label">Icon Emoji</label>
                                <input id="slack-iconemo" v-model="notification.slackiconemo" type="text" class="form-control">
                                <label for="slack-channel" class="form-label">Channel Name</label>
                                <input id="slack-channel-name" v-model="notification.slackchannel" type="text" class="form-control">
                                <label for="slack-button-url" class="form-label">Uptime Kuma URL</label>
                                <input id="slack-button" v-model="notification.slackbutton" type="text" class="form-control">
                                <div class="form-text">
                                    <span style="color:red;"><sup>*</sup></span>Required
                                    <p style="margin-top: 8px;">
                                        More info about webhooks on: <a href="https://api.slack.com/messaging/webhooks" target="_blank">https://api.slack.com/messaging/webhooks</a>
                                    </p>
                                    <p style="margin-top: 8px;">
                                        Enter the channel name on Slack Channel Name field if you want to bypass the webhook channel. Ex: #other-channel
                                    </p>
                                    <p style="margin-top: 8px;">
                                        If you leave the Uptime Kuma URL field blank, it will default to the Project Github page.
                                    </p>
                                    <p style="margin-top: 8px;">
                                        Emoji cheat sheet: <a href="https://www.webfx.com/tools/emoji-cheat-sheet/" target="_blank">https://www.webfx.com/tools/emoji-cheat-sheet/</a>
                                    </p>
                                </div>
                            </div>
                        </template>

                        <template v-if="notification.type === 'pushover'">
                            <div class="mb-3">
                                <label for="pushover-user" class="form-label">User Key<span style="color:red;"><sup>*</sup></span></label>
                                <input id="pushover-user" v-model="notification.pushoveruserkey" type="text" class="form-control" required>
                                <label for="pushover-app-token" class="form-label">Application Token<span style="color:red;"><sup>*</sup></span></label>
                                <input id="pushover-app-token" v-model="notification.pushoverapptoken" type="text" class="form-control" required>
                                <label for="pushover-device" class="form-label">Device</label>
                                <input id="pushover-device" v-model="notification.pushoverdevice" type="text" class="form-control">
                                <label for="pushover-device" class="form-label">Message Title</label>
                                <input id="pushover-title" v-model="notification.pushovertitle" type="text" class="form-control">
                                <label for="pushover-priority" class="form-label">Priority</label>
                                <select id="pushover-priority" v-model="notification.pushoverpriority" class="form-select">
                                    <option>-2</option>
                                    <option>-1</option>
                                    <option>0</option>
                                    <option>1</option>
                                    <option>2</option>
                                </select>
                                <label for="pushover-sound" class="form-label">Notification Sound</label>
                                <select id="pushover-sound" v-model="notification.pushoversounds" class="form-select">
                                    <option>pushover</option>
                                    <option>bike</option>
                                    <option>bugle</option>
                                    <option>cashregister</option>
                                    <option>classical</option>
                                    <option>cosmic</option>
                                    <option>falling</option>
                                    <option>gamelan</option>
                                    <option>incoming</option>
                                    <option>intermission</option>
                                    <option>mechanical</option>
                                    <option>pianobar</option>
                                    <option>siren</option>
                                    <option>spacealarm</option>
                                    <option>tugboat</option>
                                    <option>alien</option>
                                    <option>climb</option>
                                    <option>persistent</option>
                                    <option>echo</option>
                                    <option>updown</option>
                                    <option>vibrate</option>
                                    <option>none</option>
                                </select>
                                <div class="form-text">
                                    <span style="color:red;"><sup>*</sup></span>Required
                                    <p style="margin-top: 8px;">
                                        More info on: <a href="https://pushover.net/api" target="_blank">https://pushover.net/api</a>
                                    </p>
                                    <p style="margin-top: 8px;">
                                        Emergency priority (2) has default 30 second timeout between retries and will expire after 1 hour.
                                    </p>
                                    <p style="margin-top: 8px;">
                                        If you want to send notifications to different devices, fill out Device field.
                                    </p>
                                </div>
                            </div>
                        </template>

                        <template v-if="notification.type === 'apprise'">
                            <div class="mb-3">
                                <label for="apprise-url" class="form-label">Apprise URL</label>
                                <input id="apprise-url" v-model="notification.appriseURL" type="text" class="form-control" required>
                                <div class="form-text">
                                    <p>Example: twilio://AccountSid:AuthToken@FromPhoneNo</p>
                                    <p>
                                        Read more: <a href="https://github.com/caronc/apprise/wiki#notification-services" target="_blank">https://github.com/caronc/apprise/wiki#notification-services</a>
                                    </p>
                                </div>
                            </div>
                            <div class="mb-3">
                                <p>
                                    Status:
                                    <span v-if="appriseInstalled" class="text-primary">Apprise is installed</span>
                                    <span v-else class="text-danger">Apprise is not installed. <a href="https://github.com/caronc/apprise">Read more</a></span>
                                </p>
                            </div>
                        </template>
                    </div>
                    <div class="modal-footer">
                        <button v-if="id" type="button" class="btn btn-danger" :disabled="processing" @click="deleteConfirm">
                            Delete
                        </button>
                        <button type="button" class="btn btn-warning" :disabled="processing" @click="test">
                            Test
                        </button>
                        <button type="submit" class="btn btn-primary" :disabled="processing">
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>

    <Confirm ref="confirmDelete" btn-style="btn-danger" @yes="deleteNotification">
        Are you sure want to delete this notification for all monitors?
    </Confirm>
</template>

<script lang="ts">
import { Modal } from "bootstrap"
import { ucfirst } from "../util.ts"
import axios from "axios";
import { useToast } from "vue-toastification"
import Confirm from "./Confirm.vue";
const toast = useToast()

export default {
    components: {
        Confirm,
    },
    props: {},
    data() {
        return {
            model: null,
            processing: false,
            id: null,
            notification: {
                name: "",
                type: null,
                gotifyPriority: 8,
            },
            appriseInstalled: false,
        }
    },
    computed: {
        telegramGetUpdatesURL() {
            let token = "<YOUR BOT TOKEN HERE>"

            if (this.notification.telegramBotToken) {
                token = this.notification.telegramBotToken;
            }

            return `https://api.telegram.org/bot${token}/getUpdates`;
        },
    },
    watch: {
        "notification.type"(to, from) {
            let oldName;

            if (from) {
                oldName = `My ${ucfirst(from)} Alert (1)`;
            } else {
                oldName = "";
            }

            if (! this.notification.name || this.notification.name === oldName) {
                this.notification.name = `My ${ucfirst(to)} Alert (1)`
            }
        },
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal)

        this.$root.getSocket().emit("checkApprise", (installed) => {
            this.appriseInstalled = installed;
        })
    },
    methods: {

        deleteConfirm() {
            this.modal.hide();
            this.$refs.confirmDelete.show()
        },

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
                    type: null,
                }

                // Default set to Telegram
                this.notification.type = "telegram"
                this.notification.gotifyPriority = 8
            }

            this.modal.show()
        },

        submit() {
            this.processing = true;
            this.$root.getSocket().emit("addNotification", this.notification, this.id, (res) => {
                this.$root.toastRes(res)
                this.processing = false;

                if (res.ok) {
                    this.modal.hide()
                }
            })
        },

        test() {
            this.processing = true;
            this.$root.getSocket().emit("testNotification", this.notification, (res) => {
                this.$root.toastRes(res)
                this.processing = false;
            })
        },

        deleteNotification() {
            this.processing = true;
            this.$root.getSocket().emit("deleteNotification", this.id, (res) => {
                this.$root.toastRes(res)
                this.processing = false;

                if (res.ok) {
                    this.modal.hide()
                }
            })
        },

        async autoGetTelegramChatID() {
            try {
                let res = await axios.get(this.telegramGetUpdatesURL)

                if (res.data.result.length >= 1) {
                    let update = res.data.result[res.data.result.length - 1]

                    if (update.channel_post) {
                        this.notification.telegramChatID = update.channel_post.chat.id;
                    } else if (update.message) {
                        this.notification.telegramChatID = update.message.chat.id;
                    } else {
                        throw new Error("Chat ID is not found, please send a message to this bot first")
                    }

                } else {
                    throw new Error("Chat ID is not found, please send a message to this bot first")
                }

            } catch (error) {
                toast.error(error.message)
            }

        },

    },
}
</script>
