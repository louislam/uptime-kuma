<template>
    <div class="my-3">
        <div class="mb-4 pointer" @click="toggle">
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
            <LabelInput :modelValue="values.interval" placeholder="24" label="Interval" @update:model-value="set('interval', $event)" />
            <div class="my-2">
                <div class="flex-row" @click="toggleLabels">
                    <span class="pointer">
                        Labels {{ labelsVisible ? "-" : "+" }}
                    </span>
                </div>
                <div :class="!labelsVisible && 'collapse'">
                    <div v-for="[ propName, display, placeholder = '' ] in labelFields" :key="display">
                        <LabelInput :modelValue="values[propName]" :placeholder="placeholder" :label="display" @update:model-value="set(propName, $event)" />
                    </div>
                </div>
            </div>
            <div class="my-2">
                <div class="flex-row pointer" @click="toggleColors">
                    Colors {{ colorsVisible ? "-" : "+" }}
                </div>
                <div :class="!colorsVisible && 'collapse'">
                    <div v-for="[ propName, display, placeholder = '' ] in colorFields" :key="display">
                        <ColorInput :modelValue="values[propName]" :placeholder="placeholder" :label="display" @update:model-value="set(propName, $event)" />
                    </div>
                </div>
            </div>
            <div>Badge URL</div>
            <div class="row justify-content-end">
                <div class="col-11">
                    <CopyableInput id="badgeStatusURL" type="readonly" :modelValue="uptimeBadgeURL" />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { filterSearchParams } from "../../util-badges";
import CopyableInput from "../CopyableInput.vue";
import LabelInput from "./LabelInput.vue";
import ColorInput from "./ColorInput.vue";

export default {
    components: { CopyableInput,
        LabelInput,
        ColorInput },
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
            values: {
                interval: undefined,
                prefixlabel: "",
                label: "",
                suffixlabel: "",
                prefix: "",
                suffix: "",
                labelcolor: "",
                valuecolor: "",
            },
            uptimeBadgeURL: "",
            uptimeBadge10URL: "",
            uptimeBadge30URL: "",
            uptimeBadge50URL: "",
            uptimeBadge70URL: "",
            uptimeBadge100URL: "",
            visible: false,
            labelsVisible: false,
            colorsVisible: false,
        };
    },
    watch: {
        values: {
            handler() {
                this.getBadgeURL();
            },
            deep: true
        },
        monitor() {
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
        set(propName, value, $event) {
            $event && $event.preventDefault();
            this.values[propName] = value;
        },
        emitCallback(a, b, c) {
            console.log({ a,
                b,
                c });
        },
        getBadgeURL() {
            const searchParams = filterSearchParams({
                labelPrefix: this.values.prefixlabel,
                label: this.values.label,
                labelSuffix: this.values.suffixlabel,
                prefix: this.values.prefix,
                suffix: this.values.suffix,
                labelColor: this.values.labelcolor,
                color: this.values.valuecolor
            });

            this.uptimeBadgeURL = this.$root.getBadgesUrl(this.monitor.id, "uptime/{interval}", {
                interval: this.values.interval
            }, searchParams);

            //### For demo / test purpose only
            this.uptimeBadge10URL = this.$root.getBadgesUrl(this.monitor.id, "uptime/{interval}", {
                interval: this.values.interval
            }, {
                ...searchParams,
                value: 0.1,
            });
            this.uptimeBadge30URL = this.$root.getBadgesUrl(this.monitor.id, "uptime/{interval}", {
                interval: this.values.interval
            }, {
                ...searchParams,
                value: 0.3,
            });
            this.uptimeBadge50URL = this.$root.getBadgesUrl(this.monitor.id, "uptime/{interval}", {
                interval: this.values.interval
            }, {
                ...searchParams,
                value: 0.5,
            });
            this.uptimeBadge70URL = this.$root.getBadgesUrl(this.monitor.id, "uptime/{interval}", {
                interval: this.values.interval
            }, {
                ...searchParams,
                value: 0.7,
            });
            this.uptimeBadge100URL = this.$root.getBadgesUrl(this.monitor.id, "uptime/{interval}", {
                interval: this.values.interval
            }, {
                ...searchParams,
                value: 1,
            });
            //###
        },
    },
};
</script>
