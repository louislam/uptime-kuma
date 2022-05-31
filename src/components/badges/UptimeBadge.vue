<template>
    <div class="my-3">
        <div class="mb-4" style="cursor: pointer" @click="toggle">
            <div>
                <strong>Uptime Badge</strong><span class="ps-2">{{ visible ? "-" : "+" }}</span>
            </div>
            <img :srcset="uptimeBadge10URL" alt="Badge" />&nbsp;
            <img :srcset="uptimeBadge30URL" alt="Badge" />&nbsp;
            <img :srcset="uptimeBadge50URL" alt="Badge" />&nbsp;
            <img :srcset="uptimeBadge70URL" alt="Badge" />&nbsp;
            <img :srcset="uptimeBadge100URL" alt="Badge" />
        </div>
        <div v-if="visible" class="border-start ps-2">
            <div class="row ms-2">
                <label class="col-3 text-end col-form-label">Interval (h)</label>
                <div class="col-9">
                    <div class="input-group">
                        <input
                            v-model.lazy="interval"
                            class="form-control"
                            placeholder="24"
                        />
                        <button
                            v-if="interval !== undefined"
                            class="btn btn-outline-danger"
                            @click="
                                (event) => {
                                    event.preventDefault();
                                    interval = undefined;
                                }
                            "
                        >
                            x
                        </button>
                    </div>
                </div>
            </div>
            <div class="my-2">
                <div class="flex-row" @click="toggleLabels">
                    <h6 style="cursor: pointer">
                        Labels {{ labelsVisible ? "-" : "+" }}
                    </h6>
                </div>
                <div :class="!labelsVisible && 'collapse'">
                    <div
                        v-for="[
                            propName,
                            display,
                            placeholder = '',
                        ] in labelFields"
                        :key="display"
                        class="row ms-2"
                    >
                        <label class="col-3 text-end col-form-label">{{
                            display
                        }}</label>
                        <div class="col-9">
                            <div class="input-group">
                                <input
                                    v-model.lazy="$data[propName]"
                                    class="form-control"
                                    :placeholder="placeholder"
                                />
                                <button
                                    v-if="$data[propName] !== ''"
                                    class="btn btn-outline-danger"
                                    @click="
                                        (event) => {
                                            event.preventDefault();
                                            $data[propName] = '';
                                        }
                                    "
                                >
                                    x
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="my-2">
                <div class="flex-row" @click="toggleColors">
                    <h6 style="cursor: pointer">
                        Colors {{ colorsVisible ? "-" : "+" }}
                    </h6>
                </div>
                <div :class="!colorsVisible && 'collapse'">
                    <div
                        v-for="[
                            propName,
                            display,
                            placeholder = '',
                        ] in colorFields"
                        :key="display"
                        class="row ms-2"
                    >
                        <label
                            :for="$data[propName] + 'Input'"
                            class="col-3 text-end col-form-label"
                        >{{ display }}</label>
                        <div class="col-9">
                            <div class="input-group">
                                <input
                                    :id="$data[propName] + 'Input'"
                                    v-model="$data[propName]"
                                    class="form-control"
                                    :placeholder="placeholder"
                                />
                                <button
                                    type="button"
                                    class="btn btn-outline-secondary dropdown-toggle border-primary"
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                >
                                    <span class="visually-hidden">Toggle Dropdown</span>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    <li
                                        v-for="color in colors"
                                        :key="propName + color"
                                        :value="color"
                                        :label="color"
                                    >
                                        <a
                                            class="dropdown-item"
                                            href="#"
                                            @click="
                                                () => {
                                                    $data[propName] = color;
                                                }
                                            "
                                        >{{ color }}</a>
                                    </li>
                                </ul>
                                <input
                                    v-model="$data[propName]"
                                    type="color"
                                    class="form-control form-control-color fix-width-label"
                                    title="Choose your color"
                                />
                                <button
                                    v-if="$data[propName] !== ''"
                                    class="btn btn-outline-danger"
                                    @click="
                                        (event) => {
                                            event.preventDefault();
                                            $data[propName] = '';
                                        }
                                    "
                                >
                                    x
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="">
                <h6>Badge URL</h6>
                <div class="ms-2">
                    <CopyableInput
                        type="readonly"
                        :modelValue="uptimeBadgeURL"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { buildUrl } from "../../util-badges";
import CopyableInput from "../CopyableInput.vue";

export default {
    components: { CopyableInput },
    props: {
        colors: {
            default: () => [ "red", "green" ],
            type: Array,
        },
        monitor: {
            default: () => {},
            type: Object,
        },
    },
    data() {
        return {
            labelFields: [
                [ "prefixlabel", "prefix Label" ],
                [ "label", "Label" ],
                [ "suffixlabel", "suffix Label", "h" ],
                [ "prefix", "prefix Value" ],
                [ "suffix", "suffix Value", "%" ],
            ],
            colorFields: [
                [ "labelcolor", "Label", "grey" ],
                [ "valuecolor", "Value", "" ],
            ],
            prefixlabel: "",
            label: "",
            suffixlabel: "",
            prefix: "",
            suffix: "",
            labelcolor: "",
            valuecolor: "",
            uptimeBadgeURL: "",
            uptimeBadge10URL: "",
            uptimeBadge30URL: "",
            uptimeBadge50URL: "",
            uptimeBadge70URL: "",
            uptimeBadge100URL: "",
            visible: false,
            labelsVisible: false,
            colorsVisible: false,
            interval: undefined,
        };
    },
    watch: {
        interval() {
            this.getBadgeURL();
        },
        prefixlabel() {
            this.getBadgeURL();
        },
        label() {
            this.getBadgeURL();
        },
        suffixlabel() {
            this.getBadgeURL();
        },
        prefix() {
            this.getBadgeURL();
        },
        suffix() {
            this.getBadgeURL();
        },
        monitor() {
            this.getBadgeURL();
        },
        labelcolor() {
            this.getBadgeURL();
        },
        valuecolor() {
            this.getBadgeURL();
        },
    },
    mounted() {
        this.getBadgeURL();
    },
    methods: {
        toggle() {
            this.visible = !this.visible;
        },
        toggleLabels() {
            this.labelsVisible = !this.labelsVisible;
        },
        toggleColors() {
            this.colorsVisible = !this.colorsVisible;
        },
        getBadgeURL() {
            const baseUrlString =
                this.$root.badgeBaseURL +
                "/" +
                this.monitor.id +
                "/uptime" +
                (this.interval ? "/" + this.interval : "");
            const searchParamsRaw = {};
            if (this.prefixlabel) {
                searchParamsRaw.labelPrefix = this.prefixlabel;
            }
            if (this.label) {
                searchParamsRaw.label = this.label;
            }
            if (this.suffixlabel) {
                searchParamsRaw.labelSuffix = this.suffixlabel;
            }

            if (this.prefix) {
                searchParamsRaw.prefix = this.prefix;
            }
            if (this.suffix) {
                searchParamsRaw.suffix = this.suffix;
            }

            if (this.labelcolor) {
                searchParamsRaw.labelColor = this.labelcolor;
            }
            if (this.valuecolor) {
                searchParamsRaw.color = this.valuecolor;
            }
            this.uptimeBadgeURL = buildUrl(baseUrlString, searchParamsRaw);

            //### For demo / test purpose only
            this.uptimeBadge10URL = buildUrl(baseUrlString, {
                ...searchParamsRaw,
                value: 0.1,
            });
            this.uptimeBadge30URL = buildUrl(baseUrlString, {
                ...searchParamsRaw,
                value: 0.3,
            });
            this.uptimeBadge50URL = buildUrl(baseUrlString, {
                ...searchParamsRaw,
                value: 0.5,
            });
            this.uptimeBadge70URL = buildUrl(baseUrlString, {
                ...searchParamsRaw,
                value: 0.7,
            });
            this.uptimeBadge100URL = buildUrl(baseUrlString, {
                ...searchParamsRaw,
                value: 1,
            });
            //###
        },
    },
};
</script>

<style></style>
