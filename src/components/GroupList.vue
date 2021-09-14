<template>
    <!-- Group List -->
    <Draggable
        v-model="$root.publicGroupList"
        :disabled="!editMode"
        item-key="id"
        :animation="100"
    >
        <template #item="{ element }">
            <div>
                <!-- Group Title -->
                <h2 class="mt-5">
                    <Editable v-model="element.name" :contenteditable="editMode" tag="span" />
                </h2>

                <div class="shadow-box monitor-list mt-4 position-relative">
                    <div v-if="element.monitorList.length === 0" class="text-center no-monitor-msg">
                        {{ $t("No Monitors") }}
                    </div>

                    <!-- Monitor List -->
                    <Draggable
                        v-model="element.monitorList"
                        class="monitor-list"
                        group="same-group"
                        :disabled="!editMode"
                        :animation="100"
                        item-key="id"
                    >
                        <template #item="{ element }">
                            <div class="item">
                                <div class="row">
                                    <div class="col-6 col-md-8 small-padding">
                                        <div class="info">
                                            <Uptime :monitor="element" type="24" :pill="true" />
                                            {{ element.name }}
                                        </div>
                                    </div>
                                    <div :key="$root.userHeartbeatBar" class="col-6 col-md-4">
                                        <HeartbeatBar size="small" :monitor-id="element.id" />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </Draggable>
                </div>
            </div>
        </template>
    </Draggable>
</template>

<script>
import Draggable from "vuedraggable";
import HeartbeatBar from "./HeartbeatBar.vue";
import Uptime from "./Uptime.vue";

export default {
    name: "GroupList",
    components: {
        Draggable,
        HeartbeatBar,
        Uptime,
    },
    props: {
        editMode: {
            type: Boolean,
            required: true,
        },
    },
    data() {
        return {

        }
    },
    created() {

    }
}
</script>

<style lang="scss" scoped>
    .no-monitor-msg {
        position: absolute;
        width: 100%;
        top: 20px;
        left: 0;
    }

    .monitor-list {
        min-height: 46px;
    }

    .flip-list-move {
        transition: transform 0.5s;
    }

    .no-move {
        transition: transform 0s;
    }
</style>
