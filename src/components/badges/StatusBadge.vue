<template>
    <div :key="statusBadgeURL" class="my-3">
        <div class="mb-4 flex flex-row" style="cursor: pointer" @click="toggle">
            <div>
                <strong>Status Badge<span class="ps-2">{{
                    visible ? "-" : "+"
                }}</span></strong>
            </div>
            <img :srcset="statusBadgeUpURL" alt="Badge" />
            <span> / </span>
            <img :srcset="statusBadgeDownURL" alt="Badge" />
        </div>
        <div v-if="visible" class="border-start ps-2">
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
                        <label class="col-2 text-end col-form-label">{{
                            display
                        }}</label>
                        <div class="col-10">
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
                            class="col-2 text-end col-form-label"
                        >{{ display }}</label>
                        <div class="col-10">
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
                    <!-- <div class="row ms-2">
                        <label for="upColorInput" class="col-2 col-form-label">up</label>
                        <div class="col-10">
                            <div class="input-group">
                                <input v-model="upcolor" class="form-control" />
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
                                        :key="'upcolor' + color"
                                        :value="color"
                                        :label="color"
                                    >
                                        <a
                                            class="dropdown-item"
                                            href="#"
                                            @click="
                                                () => {
                                                    upcolor = color;
                                                }
                                            "
                                        >{{ color }}</a>
                                    </li>
                                </ul>
                                <input
                                    id="upColorInput"
                                    v-model="upcolor"
                                    type="color"
                                    class="form-control form-control-color fix-width-label"
                                    title="Choose your color"
                                />
                            </div>
                        </div>
                    </div>
                    <div class="row ms-2">
                        <label
                            for="exampleColorInput"
                            class="col-2 col-form-label"
                        >down</label>
                        <div class="col-10">
                            <div class="input-group">
                                <input
                                    v-model="downcolor"
                                    class="form-control"
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
                                        :key="'downcolor' + color"
                                        :value="color"
                                        :label="color"
                                    >
                                        <a
                                            class="dropdown-item"
                                            href="#"
                                            @click="
                                                () => {
                                                    downcolor = color;
                                                }
                                            "
                                        >{{ color }}</a>
                                    </li>
                                </ul>
                                <input
                                    id="downColorInput"
                                    v-model="downcolor"
                                    type="color"
                                    class="form-control form-control-color fix-width-label"
                                    title="Choose your color"
                                />
                            </div>
                        </div>
                    </div> -->
                </div>
            </div>
            <div class="">
                <h6>Badge URL</h6>
                <div class="ms-2">
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
import { buildUrl } from "../../util-badges";
import CopyableInput from "../CopyableInput.vue";

export default {
    components: { CopyableInput },
    props: {
        monitor: {
            default: () => {},
            type: Object,
        },
        colors: {
            default: () => [ "red", "green" ],
            type: Array,
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
            uplabel: "",
            downlabel: "",
            upcolor: "",
            downcolor: "",
            statusBadgeURL: "",
            statusBadgeUpURL: "",
            statusBadgeDownURL: "",
            visible: false,
            labelsVisible: false,
            colorsVisible: false,
        };
    },
    watch: {
        uplabel() {
            this.getStatusBadgeURL();
        },
        downlabel() {
            this.getStatusBadgeURL();
        },
        monitor() {
            this.getStatusBadgeURL();
        },
        upcolor() {
            this.getStatusBadgeURL();
        },
        downcolor() {
            this.getStatusBadgeURL();
        },
    },
    mounted() {
        this.getStatusBadgeURL();
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
        getStatusBadgeURL() {
            const baseUrlString =
                this.$root.badgeBaseURL + "/" + this.monitor.id + "/status";
            const searchParamsRaw = {};
            if (this.uplabel) {
                searchParamsRaw.upLabel = this.uplabel;
            }
            if (this.downlabel) {
                searchParamsRaw.downLabel = this.downlabel;
            }
            if (this.upcolor) {
                searchParamsRaw.upColor = this.upcolor;
            }
            if (this.downcolor) {
                searchParamsRaw.downColor = this.downcolor;
            }
            this.statusBadgeURL = buildUrl(baseUrlString, searchParamsRaw);

            //### For demo / test purpose only
            this.statusBadgeUpURL = buildUrl(baseUrlString, {
                ...searchParamsRaw,
                value: 1,
            });
            this.statusBadgeDownURL = buildUrl(baseUrlString, {
                ...searchParamsRaw,
                value: 0,
            });
            //###
        },
    },
};
</script>

<style></style>
