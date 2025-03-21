<template>
    <div ref="BadgeGeneratorModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        {{ $t("Badge Generator", [monitor.name]) }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="type" class="form-label">{{ $t("Badge Type") }}</label>
                        <select id="type" v-model="badge.type" class="form-select">
                            <option value="status">status</option>
                            <option value="uptime">uptime</option>
                            <option value="ping">ping</option>
                            <option value="avg-response">avg-response</option>
                            <option value="cert-exp">cert-exp</option>
                            <option value="response">response</option>
                        </select>
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('duration') " class="mb-3">
                        <label for="duration" class="form-label">{{ $t("Badge Duration (in hours)") }}</label>
                        <input id="duration" v-model="badge.duration" type="number" min="0" placeholder="24" class="form-control">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('label') " class="mb-3">
                        <label for="label" class="form-label">{{ $t("Badge Label") }}</label>
                        <input id="label" v-model="badge.label" type="text" class="form-control">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('prefix') " class="mb-3">
                        <label for="prefix" class="form-label">{{ $t("Badge Prefix") }}</label>
                        <input id="prefix" v-model="badge.prefix" type="text" class="form-control">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('suffix') " class="mb-3">
                        <label for="suffix" class="form-label">{{ $t("Badge Suffix") }}</label>
                        <input id="suffix" v-model="badge.suffix" type="text" placeholder="%" class="form-control">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('labelColor') " class="mb-3">
                        <label for="labelColor" class="form-label">{{ $t("Badge Label Color") }}</label>
                        <input id="labelColor" v-model="badge.labelColor" type="text" placeholder="#555" class="form-control">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('color') " class="mb-3">
                        <label for="color" class="form-label">{{ $t("Badge Color") }}</label>
                        <input id="color" v-model="badge.color" type="text" :placeholder="badgeConstants.defaultUpColor" class="form-control">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('labelPrefix') " class="mb-3">
                        <label for="labelPrefix" class="form-label">{{ $t("Badge Label Prefix") }}</label>
                        <input id="labelPrefix" v-model="badge.labelPrefix" type="text" class="form-control">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('labelSuffix') " class="mb-3">
                        <label for="labelSuffix" class="form-label">{{ $t("Badge Label Suffix") }}</label>
                        <input id="labelSuffix" v-model="badge.labelSuffix" type="text" placeholder="h" class="form-control">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('upColor') " class="mb-3">
                        <label for="upColor" class="form-label">{{ $t("Badge Up Color") }}</label>
                        <input id="upColor" v-model="badge.upColor" type="text" class="form-control" :placeholder="badgeConstants.defaultUpColor">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('downColor') " class="mb-3">
                        <label for="downColor" class="form-label">{{ $t("Badge Down Color") }}</label>
                        <input id="downColor" v-model="badge.downColor" type="text" class="form-control" :placeholder="badgeConstants.defaultDownColor">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('pendingColor') " class="mb-3">
                        <label for="pendingColor" class="form-label">{{ $t("Badge Pending Color") }}</label>
                        <input id="pendingColor" v-model="badge.pendingColor" type="text" class="form-control" :placeholder="badgeConstants.defaultPendingColor">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('maintenanceColor') " class="mb-3">
                        <label for="maintenanceColor" class="form-label">{{ $t("Badge Maintenance Color") }}</label>
                        <input id="maintenanceColor" v-model="badge.maintenanceColor" type="text" class="form-control" :placeholder="badgeConstants.defaultMaintenanceColor">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('warnColor') " class="mb-3">
                        <label for="warnColor" class="form-label">{{ $t("Badge Warn Color") }}</label>
                        <input id="warnColor" v-model="badge.warnColor" type="text" class="form-control" :placeholder="badgeConstants.defaultMaintenanceColor">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('warnDays') " class="mb-3">
                        <label for="warnDays" class="form-label">{{ $t("Badge Warn Days") }}</label>
                        <input id="warnDays" v-model="badge.warnDays" type="number" min="0" class="form-control" :placeholder="badgeConstants.defaultCertExpireWarnDays">
                    </div>

                    <div v-if=" (parameters[badge.type || 'null'] || [] ).includes('downDays') " class="mb-3">
                        <label for="downDays" class="form-label">{{ $t("Badge Down Days") }}</label>
                        <input id="downDays" v-model="badge.downDays" type="number" min="0" class="form-control" :placeholder="badgeConstants.defaultCertExpireDownDays">
                    </div>

                    <div class="mb-3">
                        <label for="style" class="form-label">{{ $t("Badge Style") }}</label>
                        <select id="style" v-model="badge.style" class="form-select">
                            <option value="plastic">plastic</option>
                            <option value="flat">flat</option>
                            <option value="flat-square">flat-square</option>
                            <option value="for-the-badge">for-the-badge</option>
                            <option value="social">social</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label for="value" class="form-label">{{ $t("Badge value (For Testing only.)") }}</label>
                        <input id="value" v-model="badge.value" type="text" class="form-control">
                    </div>

                    <div class="mb-3 pt-3 d-flex justify-content-center">
                        <img :src="badgeURL" :alt="$t('Badge Preview')">
                    </div>

                    <div class="my-3">
                        <label for="badge-url" class="form-label">{{ $t("Badge URL") }}</label>
                        <CopyableInput id="badge-url" v-model="badgeURL" type="url" disabled="disabled" />
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="submit" class="btn btn-danger" data-bs-dismiss="modal">
                        {{ $t("Close") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Modal } from "bootstrap";
import CopyableInput from "./CopyableInput.vue";
import { badgeConstants } from "../util.ts";

export default {
    components: {
        CopyableInput
    },
    props: {},
    emits: [],
    data() {
        return {
            model: null,
            processing: false,
            monitor: {
                id: null,
                name: null,
            },
            badge: {
                type: "status",
                duration: null,
                label: null,
                prefix: null,
                suffix: null,
                labelColor: null,
                color: null,
                labelPrefix: null,
                labelSuffix: null,
                upColor: null,
                downColor: null,
                pendingColor: null,
                maintenanceColor: null,
                warnColor: null,
                warnDays: null,
                downDays: null,
                style: "flat",
                value: null,
            },
            parameters: {
                status: [
                    "upLabel",
                    "downLabel",
                    "pendingLabel",
                    "maintenanceLabel",
                    "upColor",
                    "downColor",
                    "pendingColor",
                    "maintenanceColor",
                ],
                uptime: [
                    "duration",
                    "labelPrefix",
                    "labelSuffix",
                    "prefix",
                    "suffix",
                    "color",
                    "labelColor",
                ],
                ping: [
                    "duration",
                    "labelPrefix",
                    "labelSuffix",
                    "prefix",
                    "suffix",
                    "color",
                    "labelColor",
                ],
                "avg-response": [
                    "duration",
                    "labelPrefix",
                    "labelSuffix",
                    "prefix",
                    "suffix",
                    "color",
                    "labelColor",
                ],
                "cert-exp": [
                    "labelPrefix",
                    "labelSuffix",
                    "prefix",
                    "suffix",
                    "upColor",
                    "warnColor",
                    "downColor",
                    "warnDays",
                    "downDays",
                    "labelColor",
                ],
                response: [
                    "labelPrefix",
                    "labelSuffix",
                    "prefix",
                    "suffix",
                    "color",
                    "labelColor",
                ],
            },
            badgeConstants,
        };
    },

    computed: {
        badgeURL() {
            if (!this.monitor.id || !this.badge.type) {
                return;
            }
            let badgeURL = this.$root.baseURL + "/api/badge/" + this.monitor.id + "/" + this.badge.type;

            let parameterList = {};

            for (let parameter of this.parameters[this.badge.type] || []) {
                if (parameter === "duration" && this.badge.duration) {
                    badgeURL += "/" + this.badge.duration;
                    continue;
                }

                if (this.badge[parameter]) {
                    parameterList[parameter] = this.badge[parameter];
                }
            }

            for (let parameter of [ "label", "style", "value" ]) {
                if (parameter === "style" && this.badge.style === "flat") {
                    continue;
                }

                if (this.badge[parameter]) {
                    parameterList[parameter] = this.badge[parameter];
                }
            }

            if (Object.keys(parameterList).length > 0) {
                return badgeURL + "?" + new URLSearchParams(parameterList);
            }

            return badgeURL;
        },
    },

    mounted() {
        this.BadgeGeneratorModal = new Modal(this.$refs.BadgeGeneratorModal);
    },

    methods: {
        /**
         * Setting monitor
         * @param {number} monitorId ID of monitor
         * @param {string} monitorName Name of monitor
         * @returns {void}
         */
        show(monitorId, monitorName) {
            this.monitor = {
                id: monitorId,
                name: monitorName,
            };

            this.BadgeGeneratorModal.show();
        },
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
