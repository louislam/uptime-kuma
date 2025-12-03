<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("Status Pages") }}
            </h1>

            <div>
                <router-link to="/add-status-page" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("New Status Page") }}</router-link>
            </div>

            <div class="shadow-box">
                <template v-if="$root.statusPageListLoaded">
                    <span v-if="Object.keys($root.statusPageList).length === 0" class="d-flex align-items-center justify-content-center my-3">
                        {{ $t("No status pages") }}
                    </span>

                    <!-- use <a> instead of <router-link>, because the heartbeat won't load. -->
                    <a v-for="statusPage in $root.statusPageList" :key="statusPage.slug" :href="'/status/' + statusPage.slug" class="item">
                        <img :src="icon(statusPage.icon)" alt class="logo me-2" />
                        <div class="info">
                            <div class="title">{{ statusPage.title }}</div>
                            <div class="slug">/status/{{ statusPage.slug }}</div>
                        </div>
                        <div class="actions">
                            <button class="btn btn-danger delete-status-page" @click.stop.prevent="deleteDialog(statusPage.slug)">
                                <font-awesome-icon icon="trash" />
                                <span>{{ $t("Delete") }}</span>
                            </button>
                        </div>
                    </a>
                </template>
                <div v-else class="d-flex align-items-center justify-content-center my-3 spinner">
                    <font-awesome-icon icon="spinner" size="2x" spin />
                </div>
            </div>
        </div>
    </transition>
    <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteStatusPage">
        {{ $t("deleteStatusPageMsg") }}
    </Confirm>
</template>

<script>
import Confirm from "../components/Confirm.vue";
import { getResBaseURL } from "../util-frontend";

export default {
    components: {
        Confirm
    },
    data() {
        return {
            selectedStatusSlug: ""
        };
    },
    computed: {

    },
    mounted() {

    },
    methods: {
        /**
         * Get the correct URL for the icon
         * @param {string} icon Path for icon
         * @returns {string} Correctly formatted path including port numbers
         */
        icon(icon) {
            if (icon === "/icon.svg") {
                return icon;
            } else {
                return getResBaseURL() + icon;
            }
        },
        deleteDialog(slug) {
            this.$data.selectedStatusSlug = slug;
            this.$refs.confirmDelete.show();
        },
        deleteStatusPage() {
            this.$root.getSocket().emit("deleteStatusPage", this.$data.selectedStatusSlug, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(this.$t("successDeleted"));
                    window.location.reload();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        }
    },
};
</script>

<style lang="scss" scoped>
    @import "../assets/vars.scss";

    .item {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        border-radius: 10px;
        transition: all ease-in-out 0.15s;
        padding: 10px;

        &:hover {
            background-color: $highlight-white;

            & .actions {
                visibility: visible;
            }
        }

        &.active {
            background-color: #cdf8f4;
        }

        $logo-width: 70px;

        .logo {
            width: $logo-width;
            height: $logo-width;

            // Better when the image is loading
            min-height: 1px;
        }

        .info {
            flex: 1 1 auto;

            .title {
                font-weight: bold;
                font-size: 20px;
            }

            .slug {
                font-size: 14px;
            }
        }

        .actions {
            visibility: hidden;
            display: flex;
            align-items: center;

            .delete-status-page {
                flex: 1 1 auto;
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
            }
        }
    }

    .dark {
        .item {
            &:hover {
                background-color: $dark-bg2;
            }

            &.active {
                background-color: $dark-bg2;
            }
        }
    }

    @media (max-width: 770px) {
        .item {
            .actions {
                visibility: visible;

                .btn {
                    padding: 10px;
                }

                span {
                    display: none;
                }
            }
        }
    }
</style>
