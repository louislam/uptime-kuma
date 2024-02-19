<template>
    <div v-if="show" class="form-container">
        <form @submit.prevent="submit">
            <div>
                <object width="64" height="64" data="/icon.svg" />
                <div style="font-size: 28px; font-weight: bold; margin-top: 5px;">
                    Uptime Kuma
                </div>
            </div>

            <div v-if="info.runningSetup" class="mt-5">
                <div class="alert alert-success mx-3 px-4" role="alert">
                    <div class="d-flex align-items-center">
                        <strong>{{ $t("settingUpDatabaseMSG") }}</strong>
                        <div class="ms-3 pt-1">
                            <div class="spinner-border" role="status" aria-hidden="true"></div>
                        </div>
                    </div>
                </div>
            </div>

            <template v-if="!info.runningSetup">
                <div class="form-floating short mt-3">
                    <select id="language" v-model="$root.language" class="form-select">
                        <option v-for="(lang, i) in $i18n.availableLocales" :key="`Lang${i}`" :value="lang">
                            {{ $i18n.messages[lang].languageName }}
                        </option>
                    </select>
                    <label for="language" class="form-label">{{ $t("Language") }}</label>
                </div>

                <p class="mt-5 short">
                    {{ $t("setupDatabaseChooseDatabase") }}
                </p>

                <div class="btn-group" role="group" aria-label="Basic radio toggle button group">
                    <template v-if="info.isEnabledEmbeddedMariaDB">
                        <input id="btnradio3" v-model="dbConfig.type" type="radio" class="btn-check" autocomplete="off" value="embedded-mariadb">

                        <label class="btn btn-outline-primary" for="btnradio3">
                            Embedded MariaDB
                        </label>
                    </template>

                    <input id="btnradio2" v-model="dbConfig.type" type="radio" class="btn-check" autocomplete="off" value="mariadb">
                    <label class="btn btn-outline-primary" for="btnradio2">
                        MariaDB/MySQL
                    </label>

                    <input id="btnradio1" v-model="dbConfig.type" type="radio" class="btn-check" autocomplete="off" value="sqlite">
                    <label class="btn btn-outline-primary" for="btnradio1">
                        SQLite
                    </label>
                </div>

                <div v-if="dbConfig.type === 'embedded-mariadb'" class="mt-3 short">
                    {{ $t("setupDatabaseEmbeddedMariaDB") }}
                </div>

                <div v-if="dbConfig.type === 'mariadb'" class="mt-3 short">
                    {{ $t("setupDatabaseMariaDB") }}
                </div>

                <div v-if="dbConfig.type === 'sqlite'" class="mt-3 short">
                    {{ $t("setupDatabaseSQLite") }}
                </div>

                <template v-if="dbConfig.type === 'mariadb'">
                    <div class="form-floating mt-3 short">
                        <input id="floatingInput" v-model="dbConfig.hostname" type="text" class="form-control" required>
                        <label for="floatingInput">{{ $t("Hostname") }}</label>
                    </div>

                    <div class="form-floating mt-3 short">
                        <input id="floatingInput" v-model="dbConfig.port" type="text" class="form-control" required>
                        <label for="floatingInput">{{ $t("Port") }}</label>
                    </div>

                    <div class="form-floating mt-3 short">
                        <input id="floatingInput" v-model="dbConfig.username" type="text" class="form-control" required>
                        <label for="floatingInput">{{ $t("Username") }}</label>
                    </div>

                    <div class="form-floating mt-3 short">
                        <input id="floatingInput" v-model="dbConfig.password" type="password" class="form-control" required>
                        <label for="floatingInput">{{ $t("Password") }}</label>
                    </div>

                    <div class="form-floating mt-3 short">
                        <input id="floatingInput" v-model="dbConfig.dbName" type="text" class="form-control" required>
                        <label for="floatingInput">{{ $t("dbName") }}</label>
                    </div>
                </template>

                <button class="btn btn-primary mt-4 short" type="submit" :disabled="disabledButton">
                    {{ $t("Next") }}
                </button>
            </template>
        </form>
    </div>
</template>

<script>
import axios from "axios";
import { useToast } from "vue-toastification";
import { sleep } from "../util.ts";
const toast = useToast();

export default {
    data() {
        return {
            show: false,
            dbConfig: {
                type: undefined,
                port: 3306,
                hostname: "",
                username: "",
                password: "",
                dbName: "kuma",
            },
            info: {
                needSetup: false,
                runningSetup: false,
                isEnabledEmbeddedMariaDB: false,
            },
        };
    },
    computed: {
        disabledButton() {
            return this.dbConfig.type === undefined || this.info.runningSetup;
        },
    },
    async mounted() {
        let res = await axios.get("/setup-database-info");
        this.info = res.data;

        if (this.info && this.info.needSetup === false) {
            location.href = "/setup";
        } else {
            this.show = true;
        }
    },
    methods: {
        async submit() {
            this.info.runningSetup = true;

            try {
                await axios.post("/setup-database", {
                    dbConfig: this.dbConfig,
                });
                await sleep(2000);
                await this.goToMainServerWhenReady();
            } catch (e) {
                toast.error(e.response.data);
            } finally {
                this.info.runningSetup = false;
            }

        },

        async goToMainServerWhenReady() {
            try {
                console.log("Trying...");
                let res = await axios.get("/setup-database-info");
                if (res.data && res.data.needSetup === false) {
                    this.show = false;
                    location.href = "/setup";
                } else {
                    if (res.data) {
                        this.info = res.data;
                    }
                    throw new Error("not ready");
                }
            } catch (e) {
                console.log("Not ready yet");
                await sleep(2000);
                await this.goToMainServerWhenReady();
            }
        },

        test() {
            this.$root.toastError("not implemented");
        }
    },
};
</script>

<style lang="scss" scoped>
.form-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 40px;
    padding-bottom: 40px;
}

.btn-group {
    label {
        width: 200px;
        line-height: 55px;
        font-size: 16px;
        font-weight: bold;
    }
}

.form-floating {
    > .form-select {
        padding-left: 1.3rem;
        padding-top: 1.525rem;
        line-height: 1.35;

        ~ label {
            padding-left: 1.3rem;
        }
    }

    > label {
        padding-left: 1.3rem;
    }

    > .form-control {
        padding-left: 1.3rem;
    }
}

.short {
    width: 300px;
}

form {
    max-width: 800px;
    text-align: center;
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
}
</style>
