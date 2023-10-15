<template>
    <form @submit.prevent="submit">
        <div ref="keyaddmodal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ $t("Add API Key") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <!-- Name -->
                        <div class="mb-3">
                            <label for="name" class="form-label">{{ $t("Name") }}</label>
                            <input
                                id="name" v-model="key.name" type="text" class="form-control"
                                required
                            >
                        </div>

                        <!-- Expiry -->
                        <div class="my-3">
                            <label class="form-label">{{ $t("Expiry date") }}</label>
                            <div class="d-flex flex-row align-items-center">
                                <div class="col-6">
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
                                </div>
                                <div class="col-6 ms-3">
                                    <div class="form-check mb-0">
                                        <input
                                            id="no-expire" v-model="noExpire" class="form-check-input"
                                            type="checkbox"
                                        >
                                        <label class="form-check-label" for="no-expire">{{
                                            $t("Don't expire")
                                        }}</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
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
        <div ref="keymodal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ $t("Key Added") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>

                    <div class="modal-body">
                        <div class="mb-3">
                            {{ $t("apiKeyAddedMsg") }}
                        </div>
                        <div class="mb-3">
                            <CopyableInput v-model="clearKey" disabled="disabled" />
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                            {{ $t('Continue') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>
</template>

<script lang="ts">
import { Modal } from "bootstrap";
import dayjs from "dayjs";
import Datepicker from "@vuepic/vue-datepicker";
import CopyableInput from "./CopyableInput.vue";

export default {
    components: {
        CopyableInput,
        Datepicker
    },
    props: {},
    // emits: [ "added" ],
    data() {
        return {
            keyaddmodal: null,
            keymodal: null,
            processing: false,
            key: {},
            dark: (this.$root.theme === "dark"),
            minDate: this.$root.date(dayjs()) + " 00:00",
            clearKey: null,
            noExpire: false,
        };
    },

    mounted() {
        this.keyaddmodal = new Modal(this.$refs.keyaddmodal);
        this.keymodal = new Modal(this.$refs.keymodal);
    },

    methods: {
        /**
         * Show modal
         * @returns {void}
         */
        show() {
            this.id = null;
            this.key = {
                name: "",
                expires: this.minDate,
                active: 1,
            };

            this.keyaddmodal.show();
        },

        /**
         * Submit data to server
         * @returns {Promise<void>}
         */
        async submit() {
            this.processing = true;

            if (this.noExpire) {
                this.key.expires = null;
            }

            this.$root.addAPIKey(this.key, async (res) => {
                this.keyaddmodal.hide();
                this.processing = false;
                if (res.ok) {
                    this.clearKey = res.key;
                    this.keymodal.show();
                    this.clearForm();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        /**
         * Clear Form inputs
         * @returns {void}
         */
        clearForm() {
            this.key = {
                name: "",
                expires: this.minDate,
                active: 1,
            };
            this.noExpire = false;
        },
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dark {
    .modal-dialog .form-text, .modal-dialog p {
        color: $dark-font-color;
    }
}

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
