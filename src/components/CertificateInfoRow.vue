<template>
    <div>
        <div class="d-flex flex-row align-items-center p-1 overflow-hidden">
            <div class="m-3 ps-3">
                <div class="cert-icon">
                    <font-awesome-icon icon="file" />
                    <font-awesome-icon class="award-icon" icon="award" />
                </div>
            </div>
            <div class="m-3">
                <table class="text-start">
                    <tbody>
                        <tr class="my-3">
                            <td class="px-3">{{ $t("Subject:") }}</td>
                            <td>{{ formatSubject(cert.subject) }}</td>
                        </tr>
                        <tr class="my-3">
                            <td class="px-3">{{ $t("Valid To:") }}</td>
                            <td><Datetime :value="cert.validTo" /></td>
                        </tr>
                        <tr class="my-3">
                            <td class="px-3">{{ $t("Days Remaining:") }}</td>
                            <td>{{ cert.daysRemaining }}</td>
                        </tr>
                        <tr class="my-3">
                            <td class="px-3">{{ $t("Issuer:") }}</td>
                            <td>{{ formatSubject(cert.issuer) }}</td>
                        </tr>
                        <tr class="my-3">
                            <td class="px-3">{{ $t("Fingerprint:") }}</td>
                            <td>{{ cert.fingerprint }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="d-flex">
            <font-awesome-icon
                v-if="cert.issuerCertificate"
                class="m-2 ps-6 link-icon"
                icon="link"
            />
        </div>
        <certificate-info-row
            v-if="cert.issuerCertificate"
            :cert="cert.issuerCertificate"
        />
    </div>
</template>

<script>
import Datetime from "../components/Datetime.vue";
export default {
    name: "CertificateInfoRow",
    components: {
        Datetime,
    },
    props: {
        /** Object representing certificate */
        cert: {
            type: Object,
            required: true,
        },
    },
    methods: {
        /**
         * Format the subject of the certificate
         * @param {object} subject Object representing the certificates
         * subject
         * @returns {string} Certificate subject
         */
        formatSubject(subject) {
            if (subject.O && subject.CN && subject.C) {
                return `${subject.CN} - ${subject.O} (${subject.C})`;
            } else if (subject.O && subject.CN) {
                return `${subject.CN} - ${subject.O}`;
            } else if (subject.CN) {
                return subject.CN;
            } else {
                return "no info";
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

table {
    overflow: hidden;
}

.cert-icon {
    position: relative;
    font-size: 70px;
    color: $link-color;
    opacity: 0.5;

    .dark & {
        color: $dark-font-color;
        opacity: 0.3;
    }
}

.award-icon {
    position: absolute;
    font-size: 0.5em;
    bottom: 20%;
    left: 12%;
    color: white;

    .dark & {
        color: $dark-bg;
    }
}

.link-icon {
    font-size: 20px;
    margin-left: 50px !important;
    color: $link-color;
    opacity: 0.5;

    .dark & {
        color: $dark-font-color;
        opacity: 0.3;
    }
}
</style>
