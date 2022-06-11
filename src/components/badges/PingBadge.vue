<template>
    <div class="my-3">
        <div class="mb-4 pointer" @click="toggle">
            <div>
                <strong>Ping Badge<span class="ps-2">{{
                    visible ? "-" : "+"
                }}</span></strong>
            </div>
            <img :srcset="pingBadgeUpURL" alt="Badge" />
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
import { filterSearchParams } from "../../util-badges";
import CopyableInput from "../CopyableInput.vue";
import LabelInput from "./LabelInput.vue";
import ColorInput from "./ColorInput.vue";

export default {
    components: {
        ColorInput,
        CopyableInput,
        LabelInput,
    },
    props: {
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
            pingBadgeURL: "",
            pingBadgeUpURL: "",
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

            this.pingBadgeURL = this.$root.getBadgesUrl(this.monitor.id, "ping/{interval}", {
                interval: this.values.interval
            }, searchParams);

            //### For demo / test purpose only
            this.pingBadgeUpURL = this.$root.getBadgesUrl(this.monitor.id, "ping/{interval}", {
                interval: this.values.interval
            }, {
                ...searchParams,
                value: 10,
            });
            //###
        },
    },
};
</script>
