<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("Status Pages") }}
            </h1>

            <div>
                <router-link to="/add-status-page" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("Add New Status Page") }}</router-link>
            </div>

            <div class="shadow-box" style="min-height: 110px;">
                <a v-for="statusPage in $root.statusPageList" :key="statusPage.slug" :href="'/status/' + statusPage.slug" class="item">
                    <img :src="icon(statusPage.icon)" alt class="logo me-2" />
                    <div class="info">
                        <div class="title">{{ statusPage.title }}</div>
                        <div class="slug">/status/{{ statusPage.slug }}</div>
                    </div>
                </a>
            </div>
        </div>
    </transition>
</template>

<script>

import { getResBaseURL } from "../util-frontend";

export default {
    components: {

    },
    data() {
        return {
        };
    },
    computed: {

    },
    mounted() {

    },
    methods: {
        icon(icon) {
            if (icon === "/icon.svg") {
                return icon;
            } else {
                return getResBaseURL() + icon;
            }
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
        }

        &.active {
            background-color: #cdf8f4;
        }

        $logo-width: 70px;

        .logo {
            width: $logo-width;
        }

        .info {

            .title {
                font-weight: bold;
                font-size: 20px;
            }

            .slug {
                font-size: 14px;
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
</style>
