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
                                    <option value="email">Email</option>
                                    <option value="discord">Discord</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label for="name" class="form-label">Friendly Name</label>
                                <input type="text" class="form-control" id="name" required v-model="notification.name">
                            </div>

                            <div class="mb-3" v-if="notification.type === 'telegram'">
                                <label for="telegram-bot-token" class="form-label">Bot Token</label>
                                <input type="text" class="form-control" id="telegram-bot-token" required v-model="notification.telegramBotToken">
                                <div class="form-text">You can get a token from <a href="https://t.me/BotFather" target="_blank">https://t.me/BotFather</a>.</div>
                            </div>

                            <div class="mb-3" v-if="notification.type === 'telegram'">
                                <label for="telegram-chat-id" class="form-label">Chat ID</label>

                                <div class="input-group mb-3">
                                    <input type="text" class="form-control" id="telegram-chat-id" required v-model="notification.telegramChatID">
                                    <button class="btn btn-outline-secondary" type="button" @click="autoGetTelegramChatID" v-if="notification.telegramBotToken">Auto Get</button>
                                </div>

                                <div class="form-text">
                                    You can get your chat id by sending message to the bot and go to this url to view the chat_id:

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


                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger" @click="deleteNotification" :disabled="processing" v-if="id">Delete</button>
                        <button type="button" class="btn btn-warning" @click="test" :disabled="processing">Test</button>
                        <button type="submit" class="btn btn-primary" :disabled="processing">Save</button>
                    </div>
                </div>
            </div>
        </div>

    </form>
</template>

<script>
import { Modal } from 'bootstrap'
import { ucfirst } from "../../server/util";
import axios from "axios";
import { useToast } from 'vue-toastification'
const toast = useToast()

export default {
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
                    this.notification.telegramChatID = update.message.chat.id;
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
