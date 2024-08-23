

<template>
    <div class="mb-3">
        <label for="egosms-username" class="form-label">{{ $t("EgoSMS Username") }}</label>
        <input id="username" v-model="$parent.notification.egosmsUsername" type="text" class="form-control" placeholder="Your Username" required>
    </div>
    <div class="mb-3">
        <label for="egosms-password" class="form-label">{{ $t("EgoSMS Password") }}</label>
        <HiddenInput id="password" v-model="$parent.notification.egosmsPassword" :required="true"></HiddenInput>
    </div>
    <!-- <div class="mb-3">
        <label for="egosms-sender" class="form-label">{{ $t("egosmsSender") }}</label>
        <input id="egosms-sender" v-model="$parent.notification.egosmsSender" type="text" class="form-control" placeholder="Sender Name/ID" required>
    </div> -->
    <div class="mb-3">
        <label for="egosms-phoneNumber" class="form-label">{{ $t("EgoSMS PhoneNumber") }}</label>
        <input id="phoneNumber" v-model="$parent.notification.egosmsPhoneNumber" type="text" class="form-control" placeholder="256123456..." required>
    </div>
</template>

 <script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script> 
