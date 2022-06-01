<template>
    <div class="my-3">
        <div class="mb-4" style="cursor: pointer" @click="toggle">
            <div>
                <strong>Ping Badge<span class="ps-2">{{
                    visible ? "-" : "+"
                }}</span></strong>
            </div>
            <img :srcset="pingBadgeUpURL" alt="Badge" />
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
                    <span style="cursor: pointer">
                        Labels {{ labelsVisible ? "-" : "+" }}
                    </span>
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
                    <span style="cursor: pointer">
                        Colors {{ colorsVisible ? "-" : "+" }}
                    </span>
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
            <div>Badge URL</div>
            <div class="row justify-content-end">
                <div class="col-11">
                    <CopyableInput
                        type="readonly"
                        :modelValue="pingBadgeURL"
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
                [ "suffixlabel", "suffix Label", "h" ],
                [ "prefix", "prefix Value" ],
                [ "suffix", "suffix Value", "ms" ],
            ],
            colorFields: [
                [ "labelcolor", "Label", "grey" ],
                [ "valuecolor", "Value", "blue" ],
            ],
            prefixlabel: "",
            suffixlabel: "",
            prefix: "",
            suffix: "",
            labelcolor: "",
            valuecolor: "",
            pingBadgeUpURL: "",
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
                "/ping" +
                (this.interval ? "/" + this.interval : "");
            const searchParamsRaw = {};
            if (this.prefixlabel) {
                searchParamsRaw.labelPrefix = this.prefixlabel;
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
            this.pingBadgeURL = buildUrl(baseUrlString, searchParamsRaw);

            //### For demo / test purpose only
            this.pingBadgeUpURL = buildUrl(baseUrlString, {
                ...searchParamsRaw,
                value: 10,
            });
            //###
        },
    },
};
</script>

<style></style>
