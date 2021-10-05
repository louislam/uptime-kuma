<template>
    <div class="monitor-check mb-4">
        <div>
            <select id="type" :value="monitorCheck.type" :class="{'form-select': true, 'mb-1': !!monitorCheck.type}" @input="changeType($event.target.value)" required>
                <option value="HTTP_STATUS_CODE_SHOULD_EQUAL">
                    {{ $t("MonitorCheckTypeHttpStatusCodeShouldEqual") }}
                </option>
                <option value="RESPONSE_SHOULD_CONTAIN_TEXT">
                    {{ $t("MonitorCheckTypeResponseShouldContainText") }}
                </option>
                <option value="RESPONSE_SHOULD_NOT_CONTAIN_TEXT">
                    {{ $t("MonitorCheckTypeResponseShouldNotContainText") }}
                </option>
                <option value="RESPONSE_SHOULD_MATCH_REGEX">
                    {{ $t("MonitorCheckTypeResponseShouldMatchRegex") }}
                </option>
                <option value="RESPONSE_SHOULD_NOT_MATCH_REGEX">
                    {{ $t("MonitorCheckTypeResponseShouldNotMatchRegex") }}
                </option>
                <option value="RESPONSE_SELECTOR_SHOULD_EQUAL">
                    {{ $t("MonitorCheckTypeResponseSelectorShouldEqual") }}
                </option>
                <option value="RESPONSE_SELECTOR_SHOULD_NOT_EQUAL">
                    {{ $t("MonitorCheckTypeResponseSelectorShouldNotEqual") }}
                </option>
                <option value="RESPONSE_SELECTOR_SHOULD_MATCH_REGEX">
                    {{ $t("MonitorCheckTypeResponseSelectorShouldMatchRegex") }}
                </option>
                <option value="RESPONSE_SELECTOR_SHOULD_NOT_MATCH_REGEX">
                    {{ $t("MonitorCheckTypeResponseSelectorShouldNotMatchRegex") }}
                </option>
            </select>
            <div v-if="monitorCheck.type === 'HTTP_STATUS_CODE_SHOULD_EQUAL'">
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
            <div v-if="monitorCheck.type === 'RESPONSE_SHOULD_CONTAIN_TEXT' || monitorCheck.type === 'RESPONSE_SHOULD_NOT_CONTAIN_TEXT'">
                <input :value="monitorCheck.value" type="text" class="form-control" required :placeholder="$t('MonitorCheckValuePlaceholder')" @input="changeValue($event.target.value)">
            </div>
            <div v-if="monitorCheck.type === 'RESPONSE_SHOULD_MATCH_REGEX' || monitorCheck.type === 'RESPONSE_SHOULD_NOT_MATCH_REGEX'">
                <input type="text" class="form-control" required :value="monitorCheck.value"
                       :placeholder="$t('Regexp, Example: [a-z0-9.]+@gmail\.com')" @input="changeValue($event.target.value)"
                >
            </div>
            <div
                v-if="monitorCheck.type === 'RESPONSE_SELECTOR_SHOULD_EQUAL' || monitorCheck.type === 'RESPONSE_SELECTOR_SHOULD_NOT_EQUAL'"
            >
                <input :value="monitorCheck?.value?.selectorPath || ''" type="text" class="form-control mb-1" required :placeholder="$t('Selector, Example: customer.address.street')"
                       @input="changeSelectorPath($event.target.value)"
                >
                <input :value="monitorCheck?.value?.selectorValue || ''" type="text" class="form-control" required :placeholder="$t('Value, Example: First street')" @input="changeSelectorValue($event.target.value)">
            </div>
            <div
                v-if="monitorCheck.type === 'RESPONSE_SELECTOR_SHOULD_MATCH_REGEX' || monitorCheck.type === 'RESPONSE_SELECTOR_SHOULD_NOT_MATCH_REGEX'"
            >
                <input :value="monitorCheck?.value?.selectorPath || ''" type="text" class="form-control mb-1" required :placeholder="$t('Selector, Example: customer.contactInfo.email')"
                       @input="changeSelectorPath($event.target.value)"
                >
                <input :value="monitorCheck?.value?.selectorValue || ''" type="text" class="form-control" required :placeholder="$t('Regexp, Example: [a-z0-9.]+@gmail\.com')"
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
import { MONITOR_CHECK_SELECTOR_TYPES, MONITOR_CHECK_STRING_TYPES } from "../util.ts";

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
    },
    methods: {
        deleteMonitorCheck() {
            this.$emit("delete");
        },
        changeType(type) {
            if (MONITOR_CHECK_STRING_TYPES.includes(type) && MONITOR_CHECK_STRING_TYPES.includes(this.monitorCheck.type) ||
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
                    value: undefined
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

    input,
    select {
        border-radius: 19px 0 0 19px;
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
