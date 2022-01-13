<template>
    <div>
        <div class="notification-list my-4">
            <p v-if="$root.notificationList.length === 0">
                {{ $t("Not available, please setup.") }}
            </p>
            <p v-else>
                {{ $t("notificationDescription") }}
            </p>

            <ul class="list-group mb-3" style="border-radius: 1rem;">
                <li v-for="(notification, index) in $root.notificationList" :key="index" class="list-group-item">
                    {{ notification.name }}<br>
                    <a href="#" @click="$refs.notificationDialog.show(notification.id)">{{ $t("Edit") }}</a>
                </li>
            </ul>

            <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                {{ $t("Setup Notification") }}
            </button>
        </div>

        <NotificationDialog ref="notificationDialog" />
    </div>
</template>

<script>
import NotificationDialog from "../../components/NotificationDialog.vue";

export default {
    components: {
        NotificationDialog
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.dark {
    .list-group-item {
        background-color: $dark-bg2;
        color: $dark-font-color;
    }
}
</style>
