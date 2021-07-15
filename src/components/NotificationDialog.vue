<template>
    <form @submit.prevent="submit">

        <div class="modal fade" tabindex="-1" ref="modal" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="exampleModalLabel">Setup Notification</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">

                            <div class="mb-3">
                                <label for="type" class="form-label">Notification Type</label>
                                <select class="form-select"  id="type" v-model="notification.type">
                                    <option value="telegram">Telegram</option>
                                    <option value="webhook">Webhook</option>
                                    <option value="smtp">Email (SMTP)</option>
                                    <option value="discord">Discord</option>
                                    <option value="signal">Signal</option>
                                    <option value="gotify">Gotify</option>
                                    <option value="slack">Slack</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="name" class="form-label">Friendly Name</label>
                                <input type="text" class="form-control" id="name" required v-model="notification.name">
                            </div>

                            <template v-if="notification.type === 'telegram'">
                                <div class="mb-3">
                                    <label for="telegram-bot-token" class="form-label">Bot Token</label>
                                    <input type="text" class="form-control" id="telegram-bot-token" required v-model="notification.telegramBotToken">
                                    <div class="form-text">You can get a token from <a href="https://t.me/BotFather" target="_blank">https://t.me/BotFather</a>.</div>
                                </div>

                                <div class="mb-3">
                                    <label for="telegram-chat-id" class="form-label">Chat ID</label>

                                    <div class="input-group mb-3">
                                        <input type="text" class="form-control" id="telegram-chat-id" required v-model="notification.telegramChatID">
                                        <button class="btn btn-outline-secondary" type="button" @click="autoGetTelegramChatID" v-if="notification.telegramBotToken">Auto Get</button>
                                    </div>

                                    <div class="form-text">
                                        Support Direct Chat / Group / Channel's Chat ID

                                        <p style="margin-top: 8px;">
                                            You can get your chat id by sending message to the bot and go to this url to view the chat_id:
                                        </p>

                                        <p style="margin-top: 8px;">

                                            <template v-if="notification.telegramBotToken">
                                                <a :href="telegramGetUpdatesURL" target="_blank">{{ telegramGetUpdatesURL }}</a>
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
                                <input type="url" pattern="https?://.+"  class="form-control" id="webhook-url" required v-model="notification.webhookURL">

                            </div>

                            <div class="mb-3">
                                <label for="webhook-content-type" class="form-label">Content Type</label>
                                <select class="form-select"  id="webhook-content-type" v-model="notification.webhookContentType" required>
                                    <option value="json">application/json</option>
                                    <option value="form-data">multipart/form-data</option>
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
                                <input type="text" class="form-control" id="hostname" required v-model="notification.smtpHost">
                            </div>

                            <div class="mb-3">
                                <label for="port" class="form-label">Port</label>
                                <input type="number" class="form-control" id="port" v-model="notification.smtpPort" required min="0" max="65535" step="1">
                            </div>

                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="" id="secure"  v-model="notification.smtpSecure">
                                    <label class="form-check-label" for="secure">
                                        Secure
                                    </label>
                                </div>
                                <div class="form-text">Generally, true for 465, false for other ports.</div>
                            </div>

                            <div class="mb-3">
                                <label for="username" class="form-label">Username</label>
                                <input type="text" class="form-control" id="username" v-model="notification.smtpUsername" autocomplete="false">
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" class="form-control" id="password" v-model="notification.smtpPassword" autocomplete="false">
                            </div>

                            <div class="mb-3">
                                <label for="from-email" class="form-label">From Email</label>
                                <input type="email" class="form-control" id="from-email" required v-model="notification.smtpFrom" autocomplete="false">
                            </div>

                            <div class="mb-3">
                                <label for="to-email" class="form-label">To Email</label>
                                <input type="email" class="form-control" id="to-email" required v-model="notification.smtpTo" autocomplete="false">
                            </div>

                        </template>

                        <template v-if="notification.type === 'discord'">
                            <div class="mb-3">
                                <label for="discord-webhook-url" class="form-label">Discord Webhook URL</label>
                                <input type="text" class="form-control" id="discord-webhook-url" required v-model="notification.discordWebhookUrl" autocomplete="false">
                                <div class="form-text">You can get this by going to Server Settings -> Integrations -> Create Webhook</div>
                            </div>
                        </template>

                        <template v-if="notification.type === 'signal'">
                            <div class="mb-3">
                                <label for="signal-url" class="form-label">Post URL</label>
                                <input type="url" pattern="https?://.+"  class="form-control" id="signal-url" required v-model="notification.signalURL">

                            </div>

                            <div class="mb-3">
                                <label for="signal-number" class="form-label">Number</label>
                                <input type="text" class="form-control" id="signal-number" required v-model="notification.signalNumber">

                            </div>

                            <div class="mb-3">
                                <label for="signal-recipients" class="form-label">Recipients</label>
                                <input type="text" class="form-control" id="signal-recipients" required v-model="notification.signalRecipients">

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
                                    <input type="text" class="form-control" id="gotify-application-token" required v-model="notification.gotifyapplicationToken">
                                </div>
                                <div class="mb-3">
                                    <label for="gotify-server-url" class="form-label">Server URL</label>
                                    <div class="input-group mb-3">
                                        <input type="text" class="form-control" id="gotify-server-url" required v-model="notification.gotifyserverurl">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label for="gotify-priority" class="form-label">Priority</label>
                                    <input type="number" class="form-control" id="gotify-priority" v-model="notification.gotifyPriority" required min="0" max="10" step="1">
                                </div>
                            </template>

                        <template v-if="notification.type === 'slack'">
                            <div class="mb-3">
                                <label for="slack-webhook-url" class="form-label">Slack Webhook URL</label>
                                <input type="text" class="form-control" id="slack-webhook-url" required v-model="notification.slackwebhookURL" autocomplete="false">
                                <label for="gotify-server-url" class="form-label">Uptime Kuma URL</label>
                                    <div class="input-group mb-3">
                                        <input type="text" class="form-control" id="slack-button" required v-model="notification.slackbutton" autocomplete="false">
                                    </div>
                                <p style="margin-top: 8px;">
                                        More info on: <a href="https://api.slack.com/messaging/webhooks" target="_blank">https://api.slack.com/messaging/webhooks</a>
                                </p>
                            </div>
                        </template>

                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger" @click="deleteConfirm" :disabled="processing" v-if="id">Delete</button>
                        <button type="button" class="btn btn-warning" @click="test" :disabled="processing">Test</button>
                        <button type="submit" class="btn btn-primary" :disabled="processing">Save</button>
                    </div>
                </div>
            </div>
        </div>

    </form>

    <Confirm ref="confirmDelete" @yes="deleteNotification" btn-style="btn-danger">Are you sure want to delete this notification for all monitors?</Confirm>
</template>

<script>
import { Modal } from 'bootstrap'
const {ucfirst} = require("../../server/util")
import axios from "axios";
import { useToast } from 'vue-toastification'
import Confirm from "./Confirm.vue";
const toast = useToast()

export default {
    components: {Confirm},
    props: {

    },
    data() {
        return {
            model: null,
            processing: false,
            id: null,
            notification: {
                name: "",
                type: null,
                gotifyPriority: 8
            },
        }
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal)

        // TODO: for edit
        this.$root.getSocket().emit("getSettings", "notification", (data) => {
          //  this.notification = data
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
                oldName =  `My ${ucfirst(from)} Alert (1)`;
            } else {
                oldName = "";
            }

            if (! this.notification.name || this.notification.name === oldName) {
                this.notification.name = `My ${ucfirst(to)} Alert (1)`
            }
        }
    }
}
</script>

<style scoped>

</style>
