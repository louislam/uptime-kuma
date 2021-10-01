<template>
    <div>
        <h4>{{ $t("Certificate Info") }}</h4>
        {{ $t("Certificate Chain") }}:
        <div v-if="valid" class="rounded d-inline-flex ms-2 py-1 px-3 bg-success text-white">{{ $t("Valid") }}</div>
        <div v-if="!valid" class="rounded d-inline-flex ms-2 py-1 px-3 bg-danger text-white">{{ $t("Invalid") }}</div>
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
        certInfo: {
            type: Object,
            required: true,
        },
        valid: {
            type: Boolean,
            required: true,
        },
    },
};
</script>

<style></style>
