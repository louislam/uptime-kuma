<template>
    <div>
        <h4>{{ $t("Certificate Info") }}</h4>
        <div class="d-flex w-100">
            <div class="d-flex flex-column align-items-end w-50">
                <div class="py-1">
                    {{ $t("Certificate Chain") }}:
                </div>
                <div v-if="tlsInfo.authorizationError" class="py-1">
                    {{ $t("Reason") }}:
                </div>
            </div>
            <div class="d-flex flex-column align-items-start w-50">
                <div
                    v-if="tlsInfo.valid"
                    class="rounded d-inline-flex ms-2 text-white tag-valid"
                >
                    {{ $t("Valid") }}
                </div>
                <div
                    v-if="!tlsInfo.valid"
                    class="rounded d-inline-flex ms-2 text-white tag-invalid"
                >
                    {{ $t("Invalid") }}
                </div>
                <div v-if="tlsInfo.authorizationError" class="ms-2 pt-2 pb-1">
                    {{ tlsInfo.authorizationError }}
                </div>
            </div>
        </div>
        <certificate-info-row :cert="tlsInfo.certInfo" />
    </div>
</template>

<script>
import CertificateInfoRow from "./CertificateInfoRow.vue";
export default {
    components: {
        CertificateInfoRow,
    },
    props: {
        /** Object representing TLS information */
        tlsInfo: {
            type: Object,
            required: true,
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.tag-valid {
    padding: 2px 25px;
    background-color: $primary;
}

.tag-invalid {
    padding: 2px 25px;
    background-color: $danger;
}
</style>
