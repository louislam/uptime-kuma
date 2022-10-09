<template>
    <div class="mb-3">
        <label for="freemobileUser" class="form-label">{{ $t("Free Mobile User Identifier") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="freemobileUser" v-model="$parent.notification.freemobileUser" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="freemobilePass" class="form-label">{{ $t("Free Mobile API Key") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="freemobilePass" v-model="$parent.notification.freemobilePass" type="text" class="form-control" required>
    </div>
</template>

