<template>
    <div>
        <SAML />
        <hr />
        <OIDC />
    </div>
</template>

<script>
import SAML from "./SAML.vue";
import OIDC from "./OIDC.vue";

export default {
    components: { SAML, OIDC },
};
</script>
