<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 v-show="show" class="mb-3">
                {{ $t("Settings") }}
            </h1>

            <div class="shadow-box">
                <div class="row">
                    <div class="col-md-6">
                        <h2 class="mb-2">{{ $t("Appearance") }}</h2>

                        <div class="mb-3">
                            <label for="language" class="form-label">{{ $t("Language") }}</label>
                            <select id="language" v-model="$i18n.locale" class="form-select">
                                <option v-for="(lang, i) in $i18n.availableLocales" :key="`Lang${i}`" :value="lang">
                                    {{ $i18n.messages[lang].languageName }}
                                </option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="timezone" class="form-label">{{ $t("Theme") }}</label>

                            <div>
                                <div class="btn-group" role="group" aria-label="Basic checkbox toggle button group">
                                    <input id="btncheck1" v-model="$root.userTheme" type="radio" class="btn-check" name="theme" autocomplete="off" value="light">
                                    <label class="btn btn-outline-primary" for="btncheck1">{{ $t("Light") }}</label>

                                    <input id="btncheck2" v-model="$root.userTheme" type="radio" class="btn-check" name="theme" autocomplete="off" value="dark">
                                    <label class="btn btn-outline-primary" for="btncheck2">{{ $t("Dark") }}</label>

                                    <input id="btncheck3" v-model="$root.userTheme" type="radio" class="btn-check" name="theme" autocomplete="off" value="auto">
                                    <label class="btn btn-outline-primary" for="btncheck3">{{ $t("Auto") }}</label>
                                </div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">{{ $t("Theme - Heartbeat Bar") }}</label>
                            <div>
                                <div class="btn-group" role="group" aria-label="Basic checkbox toggle button group">
                                    <input id="btncheck4" v-model="$root.userHeartbeatBar" type="radio" class="btn-check" name="heartbeatBarTheme" autocomplete="off" value="normal">
                                    <label class="btn btn-outline-primary" for="btncheck4">{{ $t("Normal") }}</label>

                                    <input id="btncheck5" v-model="$root.userHeartbeatBar" type="radio" class="btn-check" name="heartbeatBarTheme" autocomplete="off" value="bottom">
                                    <label class="btn btn-outline-primary" for="btncheck5">{{ $t("Bottom") }}</label>

                                    <input id="btncheck6" v-model="$root.userHeartbeatBar" type="radio" class="btn-check" name="heartbeatBarTheme" autocomplete="off" value="none">
                                    <label class="btn btn-outline-primary" for="btncheck6">{{ $t("None") }}</label>
                                </div>
                            </div>
                        </div>

                        <h2 class="mt-5 mb-2">{{ $t("General") }}</h2>
                        <form class="mb-3" @submit.prevent="saveGeneral">
                            <div class="mb-3">
                                <label for="timezone" class="form-label">{{ $t("Timezone") }}</label>
                                <select id="timezone" v-model="$root.userTimezone" class="form-select">
                                    <option value="auto">
                                        {{ $t("Auto") }}: {{ guessTimezone }}
                                    </option>
                                    <option v-for="(timezone, index) in timezoneList" :key="index" :value="timezone.value">
                                        {{ timezone.name }}
                                    </option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">{{ $t("Search Engine Visibility") }}</label>

                                <div class="form-check">
                                    <input id="searchEngineIndexYes" v-model="settings.searchEngineIndex" class="form-check-input" type="radio" name="flexRadioDefault" :value="true" required>
                                    <label class="form-check-label" for="searchEngineIndexYes">
                                        {{ $t("Allow indexing") }}
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input id="searchEngineIndexNo" v-model="settings.searchEngineIndex" class="form-check-input" type="radio" name="flexRadioDefault" :value="false" required>
                                    <label class="form-check-label" for="searchEngineIndexNo">
                                        {{ $t("Discourage search engines from indexing site") }}
                                    </label>
                                </div>
                            </div>

                            <div>
                                <button class="btn btn-primary" type="submit">
                                    {{ $t("Save") }}
                                </button>
                            </div>
                        </form>

                        <template v-if="loaded">
                            <template v-if="! settings.disableAuth">
                                <h2 class="mt-5 mb-2">{{ $t("Change Password") }}</h2>
                                <form class="mb-3" @submit.prevent="savePassword">
                                    <div class="mb-3">
                                        <label for="current-password" class="form-label">{{ $t("Current Password") }}</label>
                                        <input id="current-password" v-model="password.currentPassword" type="password" class="form-control" required>
                                    </div>

                                    <div class="mb-3">
                                        <label for="new-password" class="form-label">{{ $t("New Password") }}</label>
                                        <input id="new-password" v-model="password.newPassword" type="password" class="form-control" required>
                                    </div>

                                    <div class="mb-3">
                                        <label for="repeat-new-password" class="form-label">{{ $t("Repeat New Password") }}</label>
                                        <input id="repeat-new-password" v-model="password.repeatNewPassword" type="password" class="form-control" :class="{ 'is-invalid' : invalidPassword }" required>
                                        <div class="invalid-feedback">
                                            {{ $t("passwordNotMatchMsg") }}
                                        </div>
                                    </div>

                                    <div>
                                        <button class="btn btn-primary" type="submit">
                                            {{ $t("Update Password") }}
                                        </button>
                                    </div>
                                </form>
                            </template>

                            <h2 class="mt-5 mb-2">
                                {{ $t("Two Factor Authentication") }}
                            </h2>

                            <div class="mb-3">
                                <button class="btn btn-primary me-2" type="button" @click="$refs.TwoFADialog.show()">{{ $t("2FA Settings") }}</button>
                            </div>

                            <h2 class="mt-5 mb-2">{{ $t("Export Backup") }}</h2>

                            <p>
                                {{ $t("backupDescription") }} <br />
                                ({{ $t("backupDescription2") }}) <br />
                            </p>

                            <div class="mb-2">
                                <button class="btn btn-primary" @click="downloadBackup">{{ $t("Export") }}</button>
                            </div>

                            <p><strong>{{ $t("backupDescription3") }}</strong></p>

                            <h2 class="mt-5 mb-2">{{ $t("Import Backup") }}</h2>

                            <label class="form-label">{{ $t("Options") }}:</label>
                            <br>
                            <div class="form-check form-check-inline">
                                <input id="radioKeep" v-model="importHandle" class="form-check-input" type="radio" name="radioImportHandle" value="keep">
                                <label class="form-check-label" for="radioKeep">{{ $t("Keep both") }}</label>
                            </div>
                            <div class="form-check form-check-inline">
                                <input id="radioSkip" v-model="importHandle" class="form-check-input" type="radio" name="radioImportHandle" value="skip">
                                <label class="form-check-label" for="radioSkip">{{ $t("Skip existing") }}</label>
                            </div>
                            <div class="form-check form-check-inline">
                                <input id="radioOverwrite" v-model="importHandle" class="form-check-input" type="radio" name="radioImportHandle" value="overwrite">
                                <label class="form-check-label" for="radioOverwrite">{{ $t("Overwrite") }}</label>
                            </div>
                            <div class="form-text mb-2">
                                {{ $t("importHandleDescription") }}
                            </div>

                            <div class="mb-2">
                                <input id="importBackup" type="file" class="form-control" accept="application/json">
                            </div>

                            <div class="input-group mb-2 justify-content-end">
                                <button type="button" class="btn btn-outline-primary" :disabled="processing" @click="confirmImport">
                                    <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
                                    {{ $t("Import") }}
                                </button>
                            </div>

                            <div v-if="importAlert" class="alert alert-danger mt-3" style="padding: 6px 16px;">
                                {{ importAlert }}
                            </div>

                            <h2 class="mt-5 mb-2">{{ $t("Advanced") }}</h2>

                            <div class="mb-3">
                                <button v-if="settings.disableAuth" class="btn btn-outline-primary me-1 mb-1" @click="enableAuth">{{ $t("Enable Auth") }}</button>
                                <button v-if="! settings.disableAuth" class="btn btn-primary me-1 mb-1" @click="confirmDisableAuth">{{ $t("Disable Auth") }}</button>
                                <button v-if="! settings.disableAuth" class="btn btn-danger me-1 mb-1" @click="$root.logout">{{ $t("Logout") }}</button>
                                <button class="btn btn-outline-danger me-1 mb-1" @click="confirmClearStatistics">{{ $t("Clear all statistics") }}</button>
                            </div>
                        </template>
                    </div>

                    <div class="notification-list col-md-6">
                        <div v-if="$root.isMobile" class="mt-3" />

                        <h2>{{ $t("Notifications") }}</h2>
                        <p v-if="$root.notificationList.length === 0">
                            {{ $t("Not available, please setup.") }}
                        </p>
                        <p v-else>
                            {{ $t("notificationDescription") }}
                        </p>

                        <ul class="list-group mb-3" style="border-radius: 1rem;">
                            <li v-for="(notification, index) in $root.notificationList" :key="index" class="list-group-item">
                                {{ notification.name }}<br>
                                <a href="#" @click="$refs.notificationDialog.show(notification.id)">{{ $t("Edit") }}</a>
                            </li>
                        </ul>

                        <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                            {{ $t("Setup Notification") }}
                        </button>
                    </div>
                </div>
            </div>

            <footer>
                <div class="container-fluid">
                    Uptime Kuma -
                    {{ $t("Version") }}: {{ $root.info.version }} -
                    <a href="https://github.com/louislam/uptime-kuma/releases" target="_blank" rel="noopener">{{ $t("Check Update On GitHub") }}</a>
                </div>
            </footer>

            <NotificationDialog ref="notificationDialog" />
            <TwoFADialog ref="TwoFADialog" />

            <Confirm ref="confirmDisableAuth" btn-style="btn-danger" :yes-text="$t('I understand, please disable')" :no-text="$t('Leave')" @yes="disableAuth">
                <template v-if="$i18n.locale === 'es-ES' ">
                    <p>Seguro que deseas <strong>deshabilitar la autenticación</strong>?</p>
                    <p>Es para <strong>quien implementa autenticación de terceros</strong> ante Uptime Kuma como por ejemplo Cloudflare Access.</p>
                    <p>Por favor usar con cuidado.</p>
                </template>

                <template v-else-if="$i18n.locale === 'zh-HK' ">
                    <p>你是否確認<strong>取消登入認証</strong>？</p>
                    <p>這個功能是設計給已有<strong>第三方認証</strong>的用家，例如 Cloudflare Access。</p>
                    <p>請小心使用。</p>
                </template>

                <template v-else-if="$i18n.locale === 'zh-CN' ">
                    <p>是否确定 <strong>取消登录验证</strong>？</p>
                    <p>这是为 <strong>有第三方认证</strong> 的用户提供的功能，如 Cloudflare Access</p>
                    <p>请谨慎使用！</p>
                </template>

                <template v-else-if="$i18n.locale === 'de-DE' ">
                    <p>Bist du sicher das du die <strong>Authentifizierung deaktivieren</strong> möchtest?</p>
                    <p>Es ist für <strong>jemanden der eine externe Authentifizierung</strong> vor Uptime Kuma geschaltet hat, wie z.B. Cloudflare Access.</p>
                    <p>Bitte mit Vorsicht nutzen.</p>
                </template>

                <template v-else-if="$i18n.locale === 'sr' ">
                    <p>Да ли сте сигурни да желите да <strong>искључите аутентификацију</strong>?</p>
                    <p>То је за <strong>оне који имају додату аутентификацију</strong> испред Uptime Kuma као на пример Cloudflare Access.</p>
                    <p>Молим Вас користите ово са пажњом.</p>
                </template>

                <template v-else-if="$i18n.locale === 'sr-latn' ">
                    <p>Da li ste sigurni da želite da <strong>isključite autentifikaciju</strong>?</p>
                    <p>To je za <strong>one koji imaju dodatu autentifikaciju</strong> ispred Uptime Kuma kao na primer Cloudflare Access.</p>
                    <p>Molim Vas koristite ovo sa pažnjom.</p>
                </template>

                <template v-else-if="$i18n.locale === 'ko-KR' ">
                    <p>정말로 <strong>인증 기능을 끌까요</strong>?</p>
                    <p>이 기능은 <strong>Cloudflare Access와 같은 서드파티 인증</strong>을 Uptime Kuma 앞에 둔 사용자를 위한 기능이에요.</p>
                    <p>신중하게 사용하세요.</p>
                </template>

                <template v-else-if="$i18n.locale === 'pl' ">
                    <p>Czy na pewno chcesz <strong>wyłączyć autoryzację</strong>?</p>
                    <p>Jest przeznaczony dla <strong>kogoś, kto ma autoryzację zewnętrzną</strong> przed Uptime Kuma, taką jak Cloudflare Access.</p>
                    <p>Proszę używać ostrożnie.</p>
                </template>

                <template v-else-if="$i18n.locale === 'et-EE' ">
                    <p>Kas soovid <strong>lülitada autentimise välja</strong>?</p>
                    <p>Kastuamiseks <strong>välise autentimispakkujaga</strong>, näiteks Cloudflare Access.</p>
                    <p>Palun kasuta vastutustundlikult.</p>
                </template>

                <template v-else-if="$i18n.locale === 'it-IT' ">
                    <p>Si è certi di voler <strong>disabilitare l'autenticazione</strong>?</p>
                    <p>È per <strong>chi ha l'autenticazione gestita da terze parti</strong> messa davanti ad Uptime Kuma, ad esempio Cloudflare Access.</p>
                    <p>Utilizzare con attenzione.</p>
                </template>

                <!-- English (en) -->
                <template v-else>
                    <p>Are you sure want to <strong>disable auth</strong>?</p>
                    <p>It is for <strong>someone who have 3rd-party auth</strong> in front of Uptime Kuma such as Cloudflare Access.</p>
                    <p>Please use it carefully.</p>
                </template>
            </Confirm>

            <Confirm ref="confirmClearStatistics" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="clearStatistics">
                {{ $t("confirmClearStatisticsMsg") }}
            </Confirm>
            <Confirm ref="confirmImport" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="importBackup">
                {{ $t("confirmImportMsg") }}
            </Confirm>
        </div>
    </transition>
</template>

<script>
import Confirm from "../components/Confirm.vue";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import NotificationDialog from "../components/NotificationDialog.vue";
import TwoFADialog from "../components/TwoFADialog.vue";
dayjs.extend(utc)
dayjs.extend(timezone)

import { timezoneList } from "../util-frontend";
import { useToast } from "vue-toastification"
const toast = useToast()

export default {
    components: {
        NotificationDialog,
        TwoFADialog,
        Confirm,
    },
    data() {
        return {
            timezoneList: timezoneList(),
            guessTimezone: dayjs.tz.guess(),
            show: true,
            invalidPassword: false,
            password: {
                currentPassword: "",
                newPassword: "",
                repeatNewPassword: "",
            },
            settings: {

            },
            loaded: false,
            importAlert: null,
            importHandle: "skip",
            processing: false,
        }
    },
    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },

        "$i18n.locale"() {
            localStorage.locale = this.$i18n.locale;
        },
    },

    mounted() {
        this.loadSettings();
    },

    methods: {

        saveGeneral() {
            localStorage.timezone = this.$root.userTimezone;
            this.saveSettings();
        },

        savePassword() {
            if (this.password.newPassword !== this.password.repeatNewPassword) {
                this.invalidPassword = true;
            } else {
                this.$root.getSocket().emit("changePassword", this.password, (res) => {
                    this.$root.toastRes(res)
                    if (res.ok) {
                        this.password.currentPassword = ""
                        this.password.newPassword = ""
                        this.password.repeatNewPassword = ""
                    }
                })
            }
        },

        loadSettings() {
            this.$root.getSocket().emit("getSettings", (res) => {
                this.settings = res.data;

                if (this.settings.searchEngineIndex === undefined) {
                    this.settings.searchEngineIndex = false;
                }

                this.loaded = true;
            })
        },

        saveSettings() {
            this.$root.getSocket().emit("setSettings", this.settings, (res) => {
                this.$root.toastRes(res);
                this.loadSettings();
            })
        },

        confirmDisableAuth() {
            this.$refs.confirmDisableAuth.show();
        },

        confirmClearStatistics() {
            this.$refs.confirmClearStatistics.show();
        },

        confirmImport() {
            this.$refs.confirmImport.show();
        },

        disableAuth() {
            this.settings.disableAuth = true;
            this.saveSettings();
        },

        enableAuth() {
            this.settings.disableAuth = false;
            this.saveSettings();
            this.$root.storage().removeItem("token");
        },

        downloadBackup() {
            let time = dayjs().format("YYYY_MM_DD-hh_mm_ss");
            let fileName = `Uptime_Kuma_Backup_${time}.json`;
            let monitorList = Object.values(this.$root.monitorList);
            let exportData = {
                version: this.$root.info.version,
                notificationList: this.$root.notificationList,
                monitorList: monitorList,
            }
            exportData = JSON.stringify(exportData, null, 4);
            let downloadItem = document.createElement("a");
            downloadItem.setAttribute("href", "data:application/json;charset=utf-8," + encodeURI(exportData));
            downloadItem.setAttribute("download", fileName);
            downloadItem.click();
        },

        importBackup() {
            this.processing = true;
            let uploadItem = document.getElementById("importBackup").files;

            if (uploadItem.length <= 0) {
                this.processing = false;
                return this.importAlert = this.$t("alertNoFile")
            }

            if (uploadItem.item(0).type !== "application/json") {
                this.processing = false;
                return this.importAlert = this.$t("alertWrongFileType")
            }

            let fileReader = new FileReader();
            fileReader.readAsText(uploadItem.item(0));

            fileReader.onload = item => {
                this.$root.uploadBackup(item.target.result, this.importHandle, (res) => {
                    this.processing = false;

                    if (res.ok) {
                        toast.success(res.msg);
                    } else {
                        toast.error(res.msg);
                    }
                })
            }
        },

        clearStatistics() {
            this.$root.clearStatistics((res) => {
                if (res.ok) {
                    this.$router.go();
                } else {
                    toast.error(res.msg);
                }
            })
        },
    },
}
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.shadow-box {
    padding: 20px;
}

.btn-check:active + .btn-outline-primary,
.btn-check:checked + .btn-outline-primary,
.btn-check:hover + .btn-outline-primary {
    color: #fff;
}

.dark {
    .list-group-item {
        background-color: $dark-bg2;
        color: $dark-font-color;
    }

    .btn-check:active + .btn-outline-primary,
    .btn-check:checked + .btn-outline-primary,
    .btn-check:hover + .btn-outline-primary {
        color: #000;
    }

    #importBackup {
        &::file-selector-button {
            color: $primary;
            background-color: $dark-bg;
        }

        &:hover:not(:disabled):not([readonly])::file-selector-button {
            color: $dark-font-color2;
            background-color: $primary;
        }
    }
}

footer {
    color: #aaa;
    font-size: 13px;
    margin-top: 20px;
    padding-bottom: 30px;
    text-align: center;
}
</style>
