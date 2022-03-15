<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("Status Pages") }}
            </h1>

            <div>
                <router-link to="/add-status-page" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("Add New Status Page") }}</router-link>
            </div>

            <div class="shadow-box">
                <div v-for="statusPage in $root.statusPageList" class="item">
                    <div class="row">
                        <div class="col">
                            <div class="title">{{ statusPage.title }}</div>
                            <div class="slug">/status/{{ statusPage.slug }}</div>
                        </div>
                        <div class="col-lg-6 col-xl-5">
                            <div class="btn-group">
                                <a :href="'/status/' + statusPage.slug" class="btn btn-dark">
                                    <font-awesome-icon icon="external-link-square-alt" /><br />
                                    {{ $t("View") }}
                                </a>

                                <a :href="'/status/' + statusPage.slug +'?edit'" class="btn btn-dark">
                                    <font-awesome-icon icon="pen" /><br />
                                    {{ $t("Edit") }}
                                </a>

                                <router-link to="/" class="btn btn-danger">
                                    <font-awesome-icon icon="trash" /><br />
                                    {{ $t("Delete") }}
                                </router-link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>

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

    },
};
</script>

<style lang="scss" scoped>
    @import "../assets/vars.scss";

    .item {
        display: block;
        text-decoration: none;
        padding: 13px 15px 10px 15px;
        border-radius: 10px;
        transition: all ease-in-out 0.15s;

        &:hover {
            background-color: $highlight-white;
        }

        &.active {
            background-color: #cdf8f4;
        }

        .title {
            font-weight: bold;
            font-size: 20px;
        }

        .slug {
            font-size: 14px;
        }

        .btn-group {
            //margin-top: 7px;
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
