<template>
    <div class="monitor-check mb-4">
        <div>
            <div class="side-by-side">
                <select id="invert-check" :value="invertedTypeOption" :class="{'form-select': true, 'mb-1': !!monitorCheck.type, 'me-1': true}"
                        @input="changeTypeInversion($event.target.value)" required>
                    <option value="SHOULD">{{ $t("MonitorCheckTypeShould") }}</option>
                    <option value="SHOULD_NOT">{{ $t("MonitorCheckTypeShouldNot") }}</option>
                </select>
                <select id="type" :value="monitorType" :class="{'form-select': true, 'mb-1': !!monitorCheck.type}"
                        @input="changeType($event.target.value)" required>
                    <option value="HTTP_STATUS_CODE_SHOULD_EQUAL">
                        {{ $t("MonitorCheckTypeHttpStatusCodeShouldEqual") }}
                    </option>
                    <option value="RESPONSE_SHOULD_CONTAIN_TEXT">
                        {{ $t("MonitorCheckTypeResponseShouldContainText") }}
                    </option>
                    <option value="RESPONSE_SHOULD_MATCH_REGEX">
                        {{ $t("MonitorCheckTypeResponseShouldMatchRegex") }}
                    </option>
                    <option value="RESPONSE_SELECTOR_SHOULD_EQUAL">
                        {{ $t("MonitorCheckTypeResponseSelectorShouldEqual") }}
                    </option>
                    <option value="RESPONSE_SELECTOR_SHOULD_MATCH_REGEX">
                        {{ $t("MonitorCheckTypeResponseSelectorShouldMatchRegex") }}
                    </option>
                </select>
            </div>
            <div v-if="monitorType === 'HTTP_STATUS_CODE_SHOULD_EQUAL'">
                <VueMultiselect
                    id="acceptedStatusCodes"
                    :options="acceptedStatusCodeOptions"
                    :multiple="true"
                    :close-on-select="false"
                    :clear-on-select="false"
                    :preserve-search="true"
                    placeholder="Pick Accepted Status Codes..."
                    :preselect-first="false"
                    :max-height="600"
                    :taggable="true"
                    :modelValue="monitorCheck.value"
                    @update:model-value="changeValue"
                ></VueMultiselect>
            </div>
            <div v-if="monitorType === 'RESPONSE_SHOULD_CONTAIN_TEXT'">
                <input :value="monitorCheck.value" type="text" class="form-control" required :placeholder="$t('MonitorCheckValuePlaceholder')"
                       @input="changeValue($event.target.value)">
            </div>
            <div v-if="monitorType === 'RESPONSE_SHOULD_MATCH_REGEX'">
                <input type="text" class="form-control" required :value="monitorCheck.value"
                       :placeholder="$t('Regexp, Example: [a-z0-9.]+@gmail\.com')" @input="changeValue($event.target.value)"
                >
            </div>
            <div v-if="monitorType === 'RESPONSE_SELECTOR_SHOULD_EQUAL'">
                <input :value="monitorCheck?.value?.selectorPath || ''" type="text" class="form-control mb-1" required
                       :placeholder="$t('Selector, Example: customer.address.street')"
                       @input="changeSelectorPath($event.target.value)"
                >
                <input :value="monitorCheck?.value?.selectorValue || ''" type="text" class="form-control" required
                       :placeholder="$t('Value, Example: First street')" @input="changeSelectorValue($event.target.value)">
            </div>
            <div v-if="monitorType === 'RESPONSE_SELECTOR_SHOULD_MATCH_REGEX'">
                <input :value="monitorCheck?.value?.selectorPath || ''" type="text" class="form-control mb-1" required
                       :placeholder="$t('Selector, Example: customer.contactInfo.email')"
                       @input="changeSelectorPath($event.target.value)"
                >
                <input :value="monitorCheck?.value?.selectorValue || ''" type="text" class="form-control" required
                       :placeholder="$t('Regexp, Example: [a-z0-9.]+@gmail\.com')"
                       @input="changeSelectorValue($event.target.value)"
                >
            </div>
        </div>
        <button class="btn btn-outline-danger" type="button" @click="deleteMonitorCheck">
            <font-awesome-icon icon="times" />
        </button>
    </div>
</template>

<script>
import VueMultiselect from "vue-multiselect";
import {
    MONITOR_CHECK_INVERTED_TYPES,
    MONITOR_CHECK_SELECTOR_TYPES,
    MONITOR_CHECK_STRING_TYPES,
    MONITOR_CHECK_SHOULD,
    MONITOR_CHECK_SHOULD_NOT,
    MONITOR_CHECK_MAP_NORMAL_TO_INVERTED, MONITOR_CHECK_MAP_INVERTED_TO_NORMAL, MONITOR_CHECK_HTTP_CODE_TYPES,
} from "../util.ts";

export default {
    components: {
        VueMultiselect,
    },
    props: {
        monitorCheck: {
            type: Object,
            default: () => ({
                type: undefined,
                value: undefined,
            }),
        },
    },
    emits: ["change", "delete"],
    data() {
        return {
            acceptedStatusCodeOptions: [],
            // Contains SHOULD or SHOULD_NOT
            invertedTypeOption: MONITOR_CHECK_SHOULD,
            // Always contains the normal type (never the NOT variant)
            monitorType: undefined,
        };
    },
    mounted() {
        let acceptedStatusCodeOptions = [
            "100-199",
            "200-299",
            "300-399",
            "400-499",
            "500-599",
        ];

        for (let i = 100; i <= 999; i++) {
            acceptedStatusCodeOptions.push(i.toString());
        }

        this.acceptedStatusCodeOptions = acceptedStatusCodeOptions;

        if (this.monitorCheck.type) {
            this.invertedTypeOption = MONITOR_CHECK_INVERTED_TYPES.includes(this.monitorCheck.type) ? MONITOR_CHECK_SHOULD_NOT : MONITOR_CHECK_SHOULD;
            this.monitorType = MONITOR_CHECK_MAP_INVERTED_TO_NORMAL[this.monitorCheck.type] || this.monitorCheck.type;
        }
    },
    methods: {
        deleteMonitorCheck() {
            this.$emit("delete");
        },
        changeTypeInversion(inversionType) {
            this.invertedTypeOption = inversionType;
            this.emitType();
        },
        changeType(type) {
            this.monitorType = type;
            this.emitType();
        },
        // Combine invertedTypeOption with monitorType to produce the combined this.monitorCheck.type
        emitType() {
            if (!this.monitorType) {
                return;
            }
            const type = this.invertedTypeOption === MONITOR_CHECK_SHOULD ? this.monitorType : MONITOR_CHECK_MAP_NORMAL_TO_INVERTED[this.monitorType];

            if (MONITOR_CHECK_HTTP_CODE_TYPES.includes(type) && MONITOR_CHECK_HTTP_CODE_TYPES.includes(this.monitorCheck.type) ||
                MONITOR_CHECK_STRING_TYPES.includes(type) && MONITOR_CHECK_STRING_TYPES.includes(this.monitorCheck.type) ||
                MONITOR_CHECK_SELECTOR_TYPES.includes(type) && MONITOR_CHECK_SELECTOR_TYPES.includes(this.monitorCheck.type)) {
                // Check value stays same type (string => string or object => object)
                this.$emit("change", {
                    ...this.monitorCheck,
                    type,
                });
            } else {
                // Check value switches (string => object or object => string)
                this.$emit("change", {
                    type,
                    value: undefined,
                });
            }
        },
        changeValue(value) {
            this.$emit("change", {
                ...this.monitorCheck,
                value,
            });
        },
        changeSelectorPath(selectorPath) {
            this.$emit("change", {
                ...this.monitorCheck,
                value: {
                    ...(this.monitorCheck.value || {}),
                    selectorPath,
                },
            });
        },
        changeSelectorValue(selectorValue) {
            this.$emit("change", {
                ...this.monitorCheck,
                value: {
                    ...(this.monitorCheck.value || {}),
                    selectorValue,
                },
            });
        },
    },
};
</script>

<style lang="scss" scoped>
    @import "../assets/vars.scss";
    
    .monitor-check {
        display: flex;
        
        > div:first-child {
            width: 100%;
        }
        
        .side-by-side {
            display: flex;
        
            > select:first-child {
                width: 40%;
            
                + select {
                    border-radius: 0;
                    margin-left: -1px;
                }
            }
        }
    
        input,
        select {
            border-radius: 19px 0 0 19px;
        
            &:focus {
                z-index: 1;
            }
        }
    
        button {
            margin-left: 0.25rem;
            padding-left: 15px;
            padding-right: 15px;
            border-radius: 0 19px 19px 0;
        }
    
    }
</style>

<style lang="scss">
    .monitor-check {
        .multiselect__tags {
            border-radius: 19px 0 0 19px;
        }
    }
</style>
