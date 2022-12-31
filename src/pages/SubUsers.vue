<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("SubUsers") }}
            </h1>

            <div>
                <router-link to="/add-sub-user" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("addSubUser") }}</router-link>
            </div>

            <div class="shadow-box">
                <template v-if="$root.subUserList">
                    <span v-if="Object.keys($root.subUserList).length === 0" class="d-flex align-items-center justify-content-center my-3">
                        {{ $t("No Sub Users") }}
                    </span>

                    <!-- use <a> instead of <router-link>, because the heartbeat won't load. -->
                    <a v-for="subUser in $root.subUserList" class="item">
                        <div class="left-part">
                                <div class="user">  <font-awesome-icon icon="user" /> </div>
                                <div class="info">
                                    <div class="title">{{ subUser.username }}</div>
                                </div>
                            </div>
                            <div class="buttons">
                                <div class="btn-group" role="group">
                                    <button class="btn btn-normal" @click="">
                                        <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                                    </button>
                                    <button class="btn btn-danger" @click="deleteDialog(subUser.id)">
                                        <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                                    </button>
                                </div>
                            </div>
                        </a>
                    </template>
                <div v-else class="d-flex align-items-center justify-content-center my-3 spinner">
                    <font-awesome-icon icon="spinner" size="2x" spin />
                </div>
            </div>
            <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteSubUser">
                {{ $t("deleteSubUserMsg") }}
            </Confirm>            
        </div>
    </transition>
</template>

<script>

import { getResBaseURL } from "../util-frontend";
import { getMaintenanceRelativeURL } from "../util.ts";
import Confirm from "../components/Confirm.vue";
import MaintenanceTime from "../components/MaintenanceTime.vue";
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    components: {
        Confirm,
    },
    data() {
        return {
            selectedSubUserID: undefined,
        };
    },
    computed: {
    
    },
    mounted() {

    },
    methods: {
        deleteDialog(subUserID) {
            this.selectedSubUserID = subUserID;
            this.$refs.confirmDelete.show();
        },

        deleteSubUser() {
            this.$root.deleteSubUser(this.selectedSubUserID, (res) => {
                if (res.ok) {
                    toast.success(res.msg);
                    this.$router.push("/manage-sub-users");
                } else {
                    toast.error(res.msg);
                }
            });
        },
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
        justify-content: space-between;
        padding: 10px;
        min-height: 90px;
        margin-bottom: 5px;

        .left-part {
            display: flex;
            gap: 12px;
            align-items: center;

            .user {
                width: 25px;
                height: 25px;
                border-radius: 50rem;
            }

            .info {
                .title {
                    font-weight: bold;
                    font-size: 20px;
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

    .dark {
        .item {
            &:hover {
                background-color: $dark-bg2;
            }
        }
    }
</style>
