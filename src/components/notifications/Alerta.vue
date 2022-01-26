<template>
    <div class="mb-3">
        <label for="alerta-api-endpoint" class="form-label">{{ $t("apiEndpoint") }}</label>
        <input id="alerta-api-endpoint" v-model="$parent.notification.alertaapiEndpoint" type="text" class="form-control" required>
        <label for="alerta-environment" class="form-label">{{ $t("environment") }}</label>
        <input id="alerta-environment" v-model="$parent.notification.alertaenvironment" type="text" class="form-control" required>
        <label for="alerta-api-key" class="form-label">{{ $t("apiKey") }}</label>
        <input id="alerta-api-key" v-model="$parent.notification.alertaapiKey" type="text" class="form-control" required>
        <label for="alerta-alert-state" class="form-label">{{ $t("alertState") }}</label>
        <input id="alerta-alert-state" v-model="$parent.notification.alertaalertState" type="text" class="form-control" required>
        <label for="alerta-recover-state" class="form-label">{{ $t("recoverState") }}</label>
        <input id="alerta-recover-state" v-model="$parent.notification.alertarecoverState" type="text" class="form-control" required>
    </div>
</template>
