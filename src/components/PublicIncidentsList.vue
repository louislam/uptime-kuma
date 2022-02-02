<template>
    <div class="mb-5 ">
        <h2 class="incident-title">{{ $t("Incident History") }}</h2>

        <div class="shadow-box monitor-list mt-4 position-relative">
            <div v-if="Object.values($root.publicIncidentsList).filter(incident => incident.resolved).length === 0"
                 class="text-center">
                {{ $t("No Incidents") }}
            </div>
            <!-- Incident List -->
            <template
                v-for="incident in Object.values($root.publicIncidentsList).filter(incident => incident.resolved).sort((i1, i2) => Date.parse(i2.resolvedDate) - Date.parse(i1.resolvedDate)).slice(0, 5)">
                <router-link :to="'/incident/' + incident.id">
                    <div class="item">
                        <div class="row">
                            <div class="col-12 col-md-12 small-padding">
                                <div class="info">
                                    <p class="title">{{ incident.title }}</p>
                                    <p class="description">{{ incident.description }}</p>
                                </div>
                                <div class="sub-info">
                                    <span>{{ $t("Resolved") }}</span>
                                    <font-awesome-icon icon="circle" class="dot"/>
                                    <span>{{ $root.datetime(incident.resolvedDate) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </router-link>
            </template>
            <template
                v-if="Object.values($root.publicIncidentsList).filter((incident) => incident.resolved).length > 5">
                <div class="item item-link">
                    <div class="row">
                        <div class="col-12 col-md-12 small-padding">
                                <span class="title d-flex justify-content-end">
                                    <router-link :to="'/incidents'">
                                        <span>{{ $t("Show all incidents") }} <font-awesome-icon icon="chevron-right"
                                                                                                class="chevron-right"/></span>
                                    </router-link>
                                </span>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script>

export default {
    components: {},
    props: {},
    data() {
        return {};
    },
    computed: {},
    created() {

    },
    methods: {}
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.monitor-list {
    min-height: 46px;
}

.mobile {
    .item {
        padding: 13px 0 10px 0;
    }
}

a {
    text-decoration: none;
}

.info {
    .title {
        font-weight: 700;
        font-size: 1rem;
    }

    white-space: normal !important;
}

.sub-info {
    font-size: .875rem;
    color: #637381;
}

.dot {
    font-size: 5px;
    vertical-align: middle;
    margin: 0 5px;
}

.chevron-right {
    font-size: 13px;
}

.item-link:hover {
    background-color: inherit !important;
}

</style>
