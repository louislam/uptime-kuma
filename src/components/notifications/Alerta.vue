<template>
    <div class="mb-3">
        <label for="alerta-api-endpoint" class="form-label">{{ $t("alertaApiEndpoint") }}</label>
        <input id="alerta-api-endpoint" v-model="$parent.notification.alertaApiEndpoint" type="text" class="form-control" required>
        <label for="alerta-environment" class="form-label">{{ $t("alertaEnvironment") }}</label>
        <input id="alerta-environment" v-model="$parent.notification.alertaEnvironment" type="text" class="form-control" required>
        <label for="alerta-api-key" class="form-label">{{ $t("alertaApiKey") }}</label>
        <input id="alerta-api-key" v-model="$parent.notification.alertaApiKey" type="text" class="form-control" required>
        <label for="alerta-alert-state" class="form-label">{{ $t("alertaAlertState") }}</label>
        <input id="alerta-alert-state" v-model="$parent.notification.alertaAlertState" type="text" class="form-control" placeholder="critical" required>
        <label for="alerta-recover-state" class="form-label">{{ $t("alertaRecoverState") }}</label>
        <input id="alerta-recover-state" v-model="$parent.notification.alertaRecoverState" type="text" class="form-control" placeholder="cleared" required>
    </div>
</template>
