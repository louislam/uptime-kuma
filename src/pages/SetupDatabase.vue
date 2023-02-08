<template>
    <div class="form-container">
        <form @submit.prevent="submit">
            <div>
                <object width="64" height="64" data="/icon.svg" />
                <div style="font-size: 28px; font-weight: bold; margin-top: 5px;">
                    Uptime Kuma
                </div>
            </div>

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
                <template v-if="isEnabledEmbeddedMariaDB">
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

            <p v-if="dbConfig.type === 'embedded-mariadb'" class="mt-3">
                {{ $t("setupDatabaseEmbeddedMariaDB") }}
            </p>

            <p v-if="dbConfig.type === 'mariadb'" class="mt-3">
                {{ $t("setupDatabaseMariaDB") }}
            </p>

            <p v-if="dbConfig.type === 'sqlite'" class="mt-3">
                {{ $t("setupDatabaseSQLite") }}
            </p>

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
                    <input id="floatingInput" v-model="dbConfig.password" type="passwrod" class="form-control" required>
                    <label for="floatingInput">{{ $t("Password") }}</label>
                </div>

                <div class="form-floating mt-3 short">
                    <input id="floatingInput" v-model="dbConfig.dbName" type="text" class="form-control" required>
                    <label for="floatingInput">{{ $t("dbName") }}</label>
                </div>
            </template>

            <button v-if="dbConfig.type === 'mariadb'" class="btn btn-warning mt-3" @submit.prevent="test">{{ $t("Test") }}</button>

            <button class="btn btn-primary mt-4 short" type="submit" :disabled="disabledButton">
                {{ $t("Next") }}
            </button>
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
            processing: false,
            isEnabledEmbeddedMariaDB: false,
            dbConfig: {
                type: undefined,
                port: 3306,
                hostname: "",
                username: "",
                password: "",
                dbName: "kuma",
            },
        };
    },
    computed: {
        disabledButton() {
            return this.dbConfig.type === undefined || this.processing;
        },
    },
    async mounted() {
        let res = await axios.get("/info");
        this.isEnabledEmbeddedMariaDB = res.data.isEnabledEmbeddedMariaDB;
    },
    methods: {
        async submit() {
            this.processing = true;

            try {
                let res = await axios.post("/setup-database", {
                    dbConfig: this.dbConfig,
                });

                await sleep(2000);
                // TODO: an interval to check if the main server is ready, it is ready, go to "/" again to continue the setup of admin account
                await this.goToMainServerWhenReady();
            } catch (e) {
                toast.error(e.response.data);
            } finally {
                this.processing = false;
            }

        },

        async goToMainServerWhenReady() {
            try {
                console.log("Trying...");
                let res = await axios.get("/api/entry-page");
                if (res.data && res.data.type === "entryPage") {
                    location.href = "/";
                } else {
                    throw new Error("not ready");
                }
            } catch (e) {
                console.log("Not ready yet");
                await sleep(2000);
                await this.goToMainServerWhenReady();
            }
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
