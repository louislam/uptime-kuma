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
                <input id="btnradio3" v-model="dbType" type="radio" class="btn-check" autocomplete="off" value="embedded-mariadb">

                <label class="btn btn-outline-primary" for="btnradio3">
                    Embedded MariaDB
                </label>

                <input id="btnradio2" v-model="dbType" type="radio" class="btn-check" autocomplete="off" value="mariadb">
                <label class="btn btn-outline-primary" for="btnradio2">
                    MariaDB
                </label>

                <input id="btnradio1" v-model="dbType" type="radio" class="btn-check" autocomplete="off" value="sqlite">
                <label class="btn btn-outline-primary" for="btnradio1">
                    SQLite
                </label>
            </div>

            <p v-if="dbType === 'embedded-mariadb'" class="mt-3">
                {{ $t("setupDatabaseEmbeddedMariaDB") }}
            </p>

            <p v-if="dbType === 'mariadb'" class="mt-3">
                {{ $t("setupDatabaseMariaDB") }}
            </p>

            <p v-if="dbType === 'sqlite'" class="mt-3">
                {{ $t("setupDatabaseSQLite") }}
            </p>

            <button class="btn btn-primary mt-5 short" type="submit" :disabled="disabledButton">
                {{ $t("Next") }}
            </button>
        </form>
    </div>
</template>

<script>
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    data() {
        return {
            processing: false,
            dbType: undefined,
        };
    },
    computed: {
        disabledButton() {
            return this.dbType === undefined || this.processing;
        },
    },
    mounted() {

    },
    methods: {
        submit() {
            this.processing = true;

            if (this.password !== this.repeatPassword) {
                toast.error(this.$t("PasswordsDoNotMatch"));
                this.processing = false;
                return;
            }
        },
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
