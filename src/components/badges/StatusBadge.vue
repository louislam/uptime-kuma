<template>
    <div :key="statusBadgeURL" class="my-3">
        <div class="mb-4 flex flex-row pointer" @click="toggle">
            <div>
                <strong>
                    Status Badge<span class="ps-2">{{
                        visible ? "-" : "+"
                    }}</span>
                </strong>
            </div>
            <img :srcset="statusBadgeUpURL" alt="Badge" />
            <span> / </span>
            <img :srcset="statusBadgeDownURL" alt="Badge" />
        </div>
        <div v-if="visible" class="border-start ps-2">
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
                        id="badgeStatusURL"
                        type="readonly"
                        :modelValue="statusBadgeURL"
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
    components: { CopyableInput,
        LabelInput,
        ColorInput },
    props: {
        monitor: {
            default: () => {},
            type: Object,
        },
    },
    data() {
        return {
            labelFields: [
                [ "uplabel", "Up", "Up" ],
                [ "downlabel", "Down", "Down" ],
            ],
            colorFields: [
                [ "upcolor", "Up", "green" ],
                [ "downcolor", "Down", "red" ],
            ],
            values: {
                uplabel: "",
                downlabel: "",
                upcolor: "",
                downcolor: "",
            },
            statusBadgeURL: "",
            statusBadgeUpURL: "",
            statusBadgeDownURL: "",
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
                upLabel: this.values.uplabel,
                downLabel: this.values.downlabel,
                upColor: this.values.upcolor,
                downColor: this.values.downcolor,

            });

            this.statusBadgeURL = this.$root.getBadgesUrl(this.monitor.id, "status", {}, searchParams);

            //### For demo / test purpose only
            this.statusBadgeUpURL = this.$root.getBadgesUrl(this.monitor.id, "status", {}, {
                ...searchParams,
                value: 1,
            });
            this.statusBadgeDownURL = this.$root.getBadgesUrl(this.monitor.id, "status", {}, {
                ...searchParams,
                value: 0,
            });
            //###
        },
    },
};
</script>
