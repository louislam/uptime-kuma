<template>
    <div>
        <h4>{{ $t("Certificate Info") }}</h4>
        {{ $t("Certificate Chain") }}:
        <div
            v-if="valid"
            class="rounded d-inline-flex ms-2 text-white tag-valid"
        >
            {{ $t("Valid") }}
        </div>
        <div
            v-if="!valid"
            class="rounded d-inline-flex ms-2 text-white tag-invalid"
        >
            {{ $t("Invalid") }}
        </div>
        <certificate-info-row :cert="certInfo" />
    </div>
</template>

<script>
import CertificateInfoRow from "./CertificateInfoRow.vue";
export default {
    components: {
        CertificateInfoRow,
    },
    props: {
        /** Object representing certificate */
        certInfo: {
            type: Object,
            required: true,
        },
        /** Is the TLS certificate valid? */
        valid: {
            type: Boolean,
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
