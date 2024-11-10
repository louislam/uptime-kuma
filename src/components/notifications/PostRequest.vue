<template>
    <div class="mb-3">
        <label for="postrequest-url" class="form-label">{{ $t("Post URL") }}</label>
        <input id="postrequest-url" v-model="$parent.notification.postrequestURL" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="postrequest-header" class="form-label">{{ $t("Bearer Token") }}</label>
        <input id="postrequest-header" v-model="$parent.notification.postrequestToken" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="postrequest-body" class="form-label">{{ $t("Body") }}</label>
        <input id="postrequest-body" v-model="$parent.notification.postrequestBody" type="text" class="form-control" required>
    </div>
</template>
