<template>
    <div class="mb-3">
        <label for="webhook-url" class="form-label">{{ $t("Post URL") }}</label>
        <input id="webhook-url" v-model="$parent.notification.webhookURL" type="url" pattern="https?://.+" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="webhook-content-type" class="form-label">{{ $t("Content Type") }}</label>
        <select id="webhook-content-type" v-model="$parent.notification.webhookContentType" class="form-select" required>
            <option value="json">
                application/json
            </option>
            <option value="form-data">
                multipart/form-data
            </option>
        </select>

        <div class="form-text">
            <p>"application/json" is good for any modern http servers such as express.js</p>
            <i18n-t keypath="webhookFormDataDesc" tag="p">
                "multipart/form-data"
                <strong>json_decode($_POST['data'])</strong>
            </i18n-t>
        </div>
    </div>
</template>
