<template>

    <div class="container-fluid">
        <div class="row">
            <div class="col-12 col-xl-4">
                <div>
                    <router-link to="/add" class="btn btn-primary">Add New Monitor</router-link>
                </div>

                <div class="shadow-box list mb-4">

                    <span v-if="$root.monitorList.length === 0">No Monitors, please <router-link to="/add">add one</router-link>.</span>

                    <router-link :to="monitorURL(item.id)" class="item" :class="{ 'disabled': ! item.active }" v-for="item in $root.monitorList">

                        <div class="row">
                        	<div class="col-6">

                                <div class="info">
                                    <span class="badge rounded-pill bg-primary">{{ item.upRate }}%</span>
                                    {{ item.name }}
                                </div>

                            </div>
                        	<div class="col-6">
                                <HeartbeatBar size="small" :monitor-id="item.id" />
                            </div>
                        </div>

                    </router-link>

                </div>
            </div>
            <div class="col-12 col-xl-8">
                <router-view />
            </div>
        </div>
    </div>

</template>

<script>

import HeartbeatBar from "../components/HeartbeatBar.vue";

export default {
    components: {
        HeartbeatBar
    },
    data() {
        return {
        }
    },
    methods: {
        monitorURL(id) {
            return "/dashboard/" + id;
        }
    }
}
</script>

<style scoped lang="scss">
@import "../assets/vars.scss";

.container-fluid {
    width: 98%
}

.list {
    margin-top: 25px;
    height: auto;
    min-height: calc(100vh - 200px);

    .item {
        display: block;
        text-decoration: none;
        padding: 15px 15px 12px 15px;
        border-radius: 10px;
        transition: all ease-in-out 0.15s;

        &.disabled {
            opacity: 0.3;
        }

        .info {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        &:hover {
            background-color: $highlight-white;
        }

        &.active {
            background-color: #cdf8f4;
        }
    }
}

.hp-bar {
    white-space: nowrap;
    margin-top: 4px;
    text-align: right;

    div {
        display: inline-block;
        background-color: $primary;
        width: 0.35rem;
        height: 1rem;
        margin: 0.15rem;
        border-radius: 50rem;
        transition: all ease-in-out 0.15s;

        &.empty {
            background-color: aliceblue;
        }

        &:hover {
            opacity: 0.8;
            transform: scale(1.5);
        }
    }
}

</style>
