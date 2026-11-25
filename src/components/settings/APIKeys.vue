<template>
    <div>
        <div v-if="settings.disableAuth" class="mt-5 d-flex align-items-center justify-content-center my-3">
            {{ $t("apiKeysDisabledMsg") }}
        </div>
        <div v-else>
            <div class="add-btn">
                <button class="btn btn-primary me-2" type="button" @click="$refs.apiKeyDialog.show()">
                    <font-awesome-icon icon="plus" />
                    {{ $t("Add API Key") }}
                </button>
            </div>

            <div v-if="apiKeyList.length === 0">
                <span class="d-flex align-items-center justify-content-center my-3">
                    {{ $t("No API Keys") }}
                </span>
            </div>

            <div v-for="group in keyGroups" :key="group.name" :data-group="group.name">
                <div v-if="group.name === 'legacy'" class="legacy-header">
                    <div class="title">{{ $t("Legacy API Keys") }}</div>
                    <div class="notice">{{ $t("legacyAPIKeyMsg") }}</div>
                </div>

                <div v-for="(item, index) in group.keys" :key="index" class="item" :class="apiKeyStatus(item)">
                    <div class="left-part">
                        <div class="circle"></div>
                        <div class="info">
                            <div class="title">{{ item.name }}</div>
                            <div class="status">
                                {{ item.enabled ? $t("apiKey-active") : $t("apiKey-inactive") }}
                            </div>
                            <div class="date">{{ $t("createdAt", { date: $root.datetime(item.createdAt) }) }}</div>
                            <div class="date">
                                {{ $t("Expires") }}:
                                {{ item.expiresAt ? $root.datetime(item.expiresAt) : $t("Never") }}
                            </div>
                        </div>
                    </div>

                    <div class="buttons">
                        <div class="btn-group" role="group">
                            <button class="btn btn-danger" @click="deleteDialog(item.id)">
                                <font-awesome-icon icon="trash" />
                                {{ $t("Delete") }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="text-center mt-3" style="font-size: 13px">
            <a href="https://github.com/louislam/uptime-kuma/wiki/Prometheus-API-Keys" target="_blank">
                {{ $t("Learn More") }}
            </a>
        </div>

        <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteKey">
            {{ $t("deleteAPIKeyMsg") }}
        </Confirm>

        <APIKeyDialog ref="apiKeyDialog" @keyAdded="loadAPIKeys" />
    </div>
</template>

<script>
import APIKeyDialog from "../../components/APIKeyDialog.vue";
import Confirm from "../Confirm.vue";

export default {
    components: {
        APIKeyDialog,
        Confirm,
    },
    data() {
        return {
            apiKeyList: [],
            selectedKeyID: null,
        };
    },
    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },

        /**
         * Split Better Auth keys and legacy keys carried over from 2.x
         * @returns {object[]} Groups of keys to render
         */
        keyGroups() {
            const isLegacy = (key) => typeof key.id === "string" && key.id.startsWith("legacy-");
            const groups = [
                { name: "current", keys: this.apiKeyList.filter((key) => !isLegacy(key)) },
                { name: "legacy", keys: this.apiKeyList.filter(isLegacy) },
            ];
            return groups.filter((group) => group.keys.length > 0);
        },
    },

    mounted() {
        this.loadAPIKeys();
    },

    methods: {
        loadAPIKeys() {
            this.$root.getAPIKeyList((res) => {
                if (res.ok) {
                    this.apiKeyList = res.apiKeyList;
                }
            });
        },

        apiKeyStatus(item) {
            if (!item.enabled) {
                return "inactive";
            }
            if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
                return "expired";
            }
            return "active";
        },

        /**
         * Show dialog to confirm deletion of Better Auth key
         * @param {string} keyID ID of key to delete
         * @returns {void}
         */
        deleteDialog(keyID) {
            this.selectedKeyID = keyID;
            this.$refs.confirmDelete.show();
        },

        /**
         * Delete a Better Auth key
         * @returns {void}
         */
        deleteKey() {
            this.$root.deleteAPIKey(this.selectedKeyID, (res) => {
                if (res.ok) {
                    this.loadAPIKeys();
                    this.$root.toastRes(res);
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.mobile {
    .item {
        flex-direction: column;
        align-items: flex-start;
        margin-bottom: 20px;
    }
}

.add-btn {
    padding-top: 20px;
    padding-bottom: 20px;
}

.legacy-header {
    margin-top: 30px;
    padding: 0 10px 10px;

    .title {
        font-weight: bold;
        font-size: 20px;
    }

    .notice {
        font-size: 14px;
        opacity: 0.8;
        margin-top: 5px;
    }
}

.item {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    border-radius: 10px;
    transition: all ease-in-out 0.15s;
    justify-content: space-between;
    padding: 10px;
    min-height: 90px;
    margin-bottom: 5px;

    &:hover {
        background-color: $highlight-white;
    }

    &.active {
        .circle {
            background-color: $primary;
        }
    }

    &.inactive {
        .circle {
            background-color: $danger;
        }
    }

    &.expired {
        .left-part {
            opacity: 0.3;
        }

        .circle {
            background-color: $dark-font-color;
        }
    }

    .left-part {
        display: flex;
        gap: 12px;
        align-items: center;

        .circle {
            width: 25px;
            height: 25px;
            border-radius: 50rem;
        }

        .info {
            .title {
                font-weight: bold;
                font-size: 20px;
            }

            .status {
                font-size: 14px;
            }
        }
    }

    .buttons {
        display: flex;
        gap: 8px;
        flex-direction: row-reverse;

        .btn-group {
            width: 310px;
        }
    }
}

.date {
    margin-top: 5px;
    display: block;
    font-size: 14px;
    background-color: rgba(255, 255, 255, 0.5);
    border-radius: 20px;
    padding: 0 10px;
    width: fit-content;

    .dark & {
        color: white;
        background-color: rgba(255, 255, 255, 0.1);
    }
}

.dark {
    .item {
        &:hover {
            background-color: $dark-bg2;
        }
    }
}
</style>
