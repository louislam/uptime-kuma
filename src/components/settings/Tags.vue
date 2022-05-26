<template>
    <div>
        <table class="table my-4 mx-1">
            <thead>
                <tr>
                    <th>{{ $t("Tag") }}</th>
                    <th>{{ $t("Monitors") }}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(tag, index) in tagsList" :key="tag.id">
                    <td class="py-3 col-5">
                        <div class="d-flex flex-row">
                            <div class="col-6 pe-1">
                                <input v-model="tag.name" type="text" class="form-control" />
                            </div>
                            <div class="col-6 ps-1">
                                <vue-multiselect
                                    v-model="tag.color"
                                    :options="colorOptions"
                                    :multiple="false"
                                    :searchable="false"
                                    :placeholder="$t('color')"
                                    label="name"
                                    select-label=""
                                    deselect-label=""
                                >
                                    <template #option="{ option }">
                                        <div
                                            class="mx-2 py-1 px-3 rounded d-inline-flex"
                                            style="height: 24px; color: white;"
                                            :style="{ backgroundColor: option.color + ' !important' }"
                                        >
                                            <span>{{ option.name }}</span>
                                        </div>
                                    </template>
                                    <template #singleLabel="{ option }">
                                        <div
                                            class="py-1 px-3 rounded d-inline-flex"
                                            style="height: 24px; color: white;"
                                            :style="{ backgroundColor: option.color + ' !important' }"
                                        >
                                            <span>{{ option.name }}</span>
                                        </div>
                                    </template>
                                </vue-multiselect>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 col-5">
                        <div v-for="monitor in monitorsByTag(tag.id)" :key="monitor.id" class="my-2">
                            {{ monitor.name }}
                        </div>
                    </td>
                    <td class="align-middle py-3">
                        <button type="button" class="btn-rm-tag btn btn-outline-danger ms-2 py-1" @click="removeTag(index)">
                            <font-awesome-icon class="" icon="trash" />
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
import { useToast } from "vue-toastification";
import VueMultiselect from "vue-multiselect";
const toast = useToast();

export default {
    components: {
        VueMultiselect,
    },

    data() {
        return {
            tagsList: null,
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
        colorOptions() {
            return [
                { name: this.$t("Gray"),
                    color: "#4B5563" },
                { name: this.$t("Red"),
                    color: "#DC2626" },
                { name: this.$t("Orange"),
                    color: "#D97706" },
                { name: this.$t("Green"),
                    color: "#059669" },
                { name: this.$t("Blue"),
                    color: "#2563EB" },
                { name: this.$t("Indigo"),
                    color: "#4F46E5" },
                { name: this.$t("Purple"),
                    color: "#7C3AED" },
                { name: this.$t("Pink"),
                    color: "#DB2777" },
            ];
        },
    },

    mounted() {
        this.getExistingTags();
    },

    methods: {
        getExistingTags() {
            this.$root.getSocket().emit("getTags", (res) => {
                if (res.ok) {
                    this.tagsList = res.tags;
                } else {
                    toast.error(res.msg);
                }
            });
        },
        removeTag(index) {
            this.tagsList.splice(index, 1);
        },
        monitorsByTag(tagId) {
            return Object.values(this.$root.monitorList).filter((monitor) => {
                return monitor.tags.find(monitorTag => monitorTag.tag_id === tagId);
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.btn-rm-tag {
    padding-left: 11px;
    padding-right: 11px;
}

</style>
