<template>
    <div v-if="! (!plugin.installed && plugin.local)" class="plugin-item pt-4 pb-2">
        <div class="info">
            <h5>{{ plugin.fullName }}</h5>
            <p class="description">
                {{ plugin.description }}
            </p>
            <span class="version">{{ $t("Version") }}: {{ plugin.version }} <a v-if="plugin.repo" :href="plugin.repo" target="_blank">Repo</a></span>
        </div>
        <div class="buttons">
            <button v-if="status === 'installing'" class="btn btn-primary" disabled>{{ $t("installing") }}</button>
            <button v-else-if="status === 'uninstalling'" class="btn btn-danger" disabled>{{ $t("uninstalling") }}</button>
            <button v-else-if="plugin.installed || status === 'installed'" class="btn btn-danger" @click="deleteConfirm">{{ $t("uninstall") }}</button>
            <button v-else class="btn btn-primary" @click="install">{{ $t("install") }}</button>
        </div>

        <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="uninstall">
            {{ $t("confirmUninstallPlugin") }}
        </Confirm>
    </div>
</template>

<script>
import Confirm from "./Confirm.vue";

export default {
    components: {
        Confirm,
    },
    props: {
        plugin: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            status: "",
        };
    },
    methods: {
        /**
         * Show confirmation for deleting a tag
         */
        deleteConfirm() {
            this.$refs.confirmDelete.show();
        },

        install() {
            this.status = "installing";

            this.$root.getSocket().emit("installPlugin", this.plugin.repo, this.plugin.name, (res) => {
                if (res.ok) {
                    this.status = "";
                    // eslint-disable-next-line vue/no-mutating-props
                    this.plugin.installed = true;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        uninstall() {
            this.status = "uninstalling";

            this.$root.getSocket().emit("uninstallPlugin", this.plugin.name, (res) => {
                if (res.ok) {
                    this.status = "";
                    // eslint-disable-next-line vue/no-mutating-props
                    this.plugin.installed = false;
                } else {
                    this.$root.toastRes(res);
                }
            });
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.plugin-item {
    display: flex;
    justify-content: space-between;
    align-content: center;
    align-items: center;

    .info {
        margin-right: 10px;
    }

    .description {
        font-size: 13px;
        margin-bottom: 0;
    }

    .version {
        font-size: 13px;
    }
}
</style>
