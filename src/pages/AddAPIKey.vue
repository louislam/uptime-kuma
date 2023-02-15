<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ $t("Add API Key") }}</h1>
            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="row">
                        <div class="col-xl-10">
                            <!-- Title -->
                            <div class="mb-3">
                                <label for="name" class="form-label">{{ $t("Name") }}</label>
                                <input
                                    id="name" v-model="key.name" type="text" class="form-control"
                                    required
                                >
                            </div>

                            <h2 class="mt-5">{{ $t("Expiry") }}</h2>

                            <!-- Expiry -->
                            <div class="my-3">
                                <label class="form-label">{{ $t("Expiry date") }}</label>
                                <Datepicker
                                    v-model="key.expires"
                                    :dark="$root.isDark"
                                    :monthChangeOnScroll="false"
                                    :minDate="minDate"
                                    format="yyyy-MM-dd HH:mm"
                                    modelType="yyyy-MM-dd HH:mm:ss"
                                    :required="!noExpire"
                                    :disabled="noExpire"
                                />

                                <div class="form-check mb-2">
                                    <input
                                        id="no-expire" v-model="noExpire" class="form-check-input"
                                        type="checkbox"
                                    >
                                    <label class="form-check-label" for="no-expire">{{
                                        $t("Don't expire")
                                    }}</label>
                                </div>
                            </div>

                            <div class="mt-4 mb-1">
                                <button
                                    id="monitor-submit-btn" class="btn btn-primary" type="submit"
                                    :disabled="processing"
                                >
                                    {{ $t("Generate") }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
            <Confirm
                ref="keyAdded"
                :yes-text="$t('Continue')"
                :no-text="$t('Add Another')"
                :title="$t('Key Added')"
                @yes="postAdd"
                @no="clearForm"
            >
                <p>{{ $t("apiKeyAddedMsg") }}</p>
                <p>{{ clearKey }}</p>
            </Confirm>
        </div>
    </transition>
</template>

<script>

import { useToast } from "vue-toastification";
import dayjs from "dayjs";
import Datepicker from "@vuepic/vue-datepicker";
import Confirm from "../components/Confirm.vue";

const toast = useToast();

export default {
    components: {
        Confirm,
        Datepicker
    },

    data() {
        return {
            processing: false,
            key: {},
            dark: (this.$root.theme === "dark"),
            minDate: this.$root.date(dayjs()) + " 00:00",
            clearKey: null,
            noExpire: false,
        };
    },

    watch: {
        "$route.fullPath"() {
            this.init();
        },
    },

    mounted() {
        this.init();
    },

    methods: {
        /** Initialise page */
        init() {
            this.clearForm();
        },

        /** Redirect user to apikey list */
        postAdd() {
            this.$router.push("/apikeys");
        },

        /** Clear the form */
        clearForm() {
            this.key = {
                name: "",
                expires: this.minDate,
                active: 1,
            };
            this.noExpire = false;
        },

        /** Submit data to server */
        async submit() {
            this.processing = true;

            if (this.noExpire) {
                this.key.expires = null;
            }

            this.$root.addAPIKey(this.key, async (res) => {
                if (res.ok) {
                    this.clearKey = res.key;
                    this.$refs.keyAdded.show();
                    this.clearForm();

                } else {
                    toast.error(res.msg);
                }
                this.processing = false;
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.shadow-box {
    padding: 20px;
}

textarea {
    min-height: 150px;
}

.dark-calendar::-webkit-calendar-picker-indicator {
    filter: invert(1);
}

.weekday-picker {
    display: flex;
    gap: 10px;

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 40px;

        .form-check-inline {
            margin-right: 0;
        }
    }
}

.day-picker {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 40px;

        .form-check-inline {
            margin-right: 0;
        }
    }
}

</style>
