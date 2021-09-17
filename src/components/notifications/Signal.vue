<template>
    <div class="mb-3">
        <label for="signal-url" class="form-label">Post URL</label>
        <input id="signal-url" v-model="$parent.notification.signalURL" type="url" pattern="https?://.+" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="signal-number" class="form-label">Number</label>
        <input id="signal-number" v-model="$parent.notification.signalNumber" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="signal-recipients" class="form-label">Recipients</label>
        <input id="signal-recipients" v-model="$parent.notification.signalRecipients" type="text" class="form-control" required>

        <div class="form-text">
            You need to have a signal client with REST API.

            <p style="margin-top: 8px;">
                You can check this url to view how to setup one:
            </p>

            <p style="margin-top: 8px;">
                <a href="https://github.com/bbernhard/signal-cli-rest-api" target="_blank">https://github.com/bbernhard/signal-cli-rest-api</a>
            </p>

            <p style="margin-top: 8px;">
                IMPORTANT: You cannot mix groups and numbers in recipients!
            </p>
        </div>
    </div>
</template>
