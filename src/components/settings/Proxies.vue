<template>
    <div>
        <!-- Proxies -->
        <div class="proxy-list my-4">
            <p v-if="$root.proxyList.length === 0">
                {{ $t("Not available, please setup.") }}
            </p>
            <p v-else>
                {{ $t("proxyDescription") }}
            </p>

            <ul class="list-group mb-3" style="border-radius: 1rem;">
                <li v-for="(proxy, index) in $root.proxyList" :key="index" class="list-group-item">
                    {{ proxy.host }}:{{ proxy.port }} ({{ proxy.protocol }})
                    <span v-if="proxy.default === true" class="badge bg-primary ms-2">{{ $t("Default") }}</span><br>
                    <a href="#" @click="$refs.proxyDialog.show(proxy.id)">{{ $t("Edit") }}</a> |
                    <a href="#" @click="$refs.proxyDialog.showClone(proxy.id)">{{ $t("Clone") }}</a>
                </li>
            </ul>

            <button class="btn btn-primary me-2" type="button" @click="$refs.proxyDialog.show()">
                {{ $t("Setup Proxy") }}
            </button>
        </div>

        <ProxyDialog ref="proxyDialog" />
    </div>
</template>

<script>
import ProxyDialog from "../../components/ProxyDialog.vue";

export default {
    components: {
        ProxyDialog
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
