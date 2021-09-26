<template>
    <div class="monitor-check mb-4">
        <div>
            <select id="type" v-model="monitorCheck.type" :class="{'form-select': true, 'mb-1': !!monitorCheck.type}">
                <option value="HTTP_STATUS_CODE_SHOULD_EQUAL">
                    {{ $t("HTTP status code should equal") }}
                </option>
                <option value="RESPONSE_SHOULD_CONTAIN_TEXT">
                    {{ $t("Response should contain text") }}
                </option>
                <option value="RESPONSE_SHOULD_NOT_CONTAIN_TEXT">
                    {{ $t("Response should not contain text") }}
                </option>
                <option value="RESPONSE_SHOULD_MATCH_REGEX">
                    {{ $t("Response should match regex") }}
                </option>
                <option value="RESPONSE_SHOULD_NOT_MATCH_REGEX">
                    {{ $t("Response should not match regex") }}
                </option>
                <option value="RESPONSE_SELECTOR_SHOULD_EQUAL">
                    {{ $t("Response selector should equal") }}
                </option>
                <option value="RESPONSE_SELECTOR_SHOULD_NOT_EQUAL">
                    {{ $t("Response selector should not equal") }}
                </option>
                <option value="RESPONSE_SELECTOR_SHOULD_MATCH_REGEX">
                    {{ $t("Response selector should match regex") }}
                </option>
                <option value="RESPONSE_SELECTOR_SHOULD_NOT_MATCH_REGEX">
                    {{ $t("Response selector should not match regex") }}
                </option>
            </select>
            <div v-if="monitorCheck.type === 'HTTP_STATUS_CODE_SHOULD_EQUAL'">
                <VueMultiselect
                    id="acceptedStatusCodes"
                    v-model="monitorCheck.value"
                    :options="acceptedStatusCodeOptions"
                    :multiple="true"
                    :close-on-select="false"
                    :clear-on-select="false"
                    :preserve-search="true"
                    placeholder="Pick Accepted Status Codes..."
                    :preselect-first="false"
                    :max-height="600"
                    :taggable="true"
                ></VueMultiselect>
            </div>
            <div v-if="monitorCheck.type === 'RESPONSE_SHOULD_CONTAIN_TEXT' || monitorCheck.type === 'RESPONSE_SHOULD_NOT_CONTAIN_TEXT'">
                <input v-model="monitorCheck.value" type="text" class="form-control" required :placeholder="$t('Value')">
            </div>
            <div v-if="monitorCheck.type === 'RESPONSE_SHOULD_MATCH_REGEX' || monitorCheck.type === 'RESPONSE_SHOULD_NOT_MATCH_REGEX'">
                <input v-model="monitorCheck.value" type="text" class="form-control" required
                       :placeholder="$t('Regexp, Example: [a-z0-9.]+@gmail\.com')">
            </div>
            <div
                v-if="monitorCheck.type === 'RESPONSE_SELECTOR_SHOULD_EQUAL' || monitorCheck.type === 'RESPONSE_SELECTOR_SHOULD_NOT_EQUAL'">
                <input v-model="monitorCheck.value.selector" type="text" class="form-control mb-1" required
                       :placeholder="$t('Selector, Example: customer.address.street')">
                <input v-model="monitorCheck.value.value" type="text" class="form-control" required :placeholder="$t('Value, Example: First street')">
            </div>
            <div
                v-if="monitorCheck.type === 'RESPONSE_SELECTOR_SHOULD_MATCH_REGEX' || monitorCheck.type === 'RESPONSE_SELECTOR_SHOULD_NOT_MATCH_REGEX'">
                <input v-model="monitorCheck.value.selector" type="text" class="form-control mb-1" required
                       :placeholder="$t('Selector, Example: customer.contactInfo.email')">
                <input v-model="monitorCheck.value.value" type="text" class="form-control" required
                       :placeholder="$t('Regexp, Example: [a-z0-9.]+@gmail\.com')">
            </div>
        </div>
        <button class="btn btn-outline-danger" type="button" @click="deleteMonitorCheck">
            <font-awesome-icon icon="times" />
        </button>
    </div>
</template>

<script>
import VueMultiselect from "vue-multiselect";

export default {
    components: {
        VueMultiselect,
    },
    props: {
        monitorCheck: {
            type: Object,
        },
    },
    data() {
        return {
            acceptedStatusCodeOptions: [],
        }
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
            this.$emit('delete');
        },
    },
}
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
