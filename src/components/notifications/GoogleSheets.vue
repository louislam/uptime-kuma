<template>
    <div class="mb-3">
        <label for="google-sheets-spreadsheet-id" class="form-label">{{ $t("Spreadsheet ID") }}</label>
        <input
            id="google-sheets-spreadsheet-id"
            v-model="$parent.notification.googleSheetsSpreadsheetId"
            type="text"
            class="form-control"
            required
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
        />
        <div class="form-text">
            {{ $t("The ID from your Google Sheets URL") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="google-sheets-sheet-name" class="form-label">{{ $t("Sheet Name") }}</label>
        <input
            id="google-sheets-sheet-name"
            v-model="$parent.notification.googleSheetsSheetName"
            type="text"
            class="form-control"
            placeholder="Sheet1"
        />
        <div class="form-text">
            {{ $t("The name of the sheet/tab (default: Sheet1)") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="google-sheets-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <HiddenInput
            id="google-sheets-access-token"
            v-model="$parent.notification.googleSheetsAccessToken"
            :required="true"
            autocomplete="new-password"
            placeholder="ya29.a0AfH6SMBx..."
        ></HiddenInput>
        <div class="form-text">
            <p>{{ $t("Google OAuth2 Access Token or Service Account Token") }}</p>
            <a href="https://developers.google.com/sheets/api/guides/authorizing" target="_blank" rel="noopener noreferrer">
                {{ $t("Learn how to get an access token") }}
            </a>
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check">
            <input
                id="google-sheets-custom-format"
                v-model="$parent.notification.googleSheetsCustomFormat"
                class="form-check-input"
                type="checkbox"
            />
            <label class="form-check-label" for="google-sheets-custom-format">
                {{ $t("Custom Column Format") }}
            </label>
        </div>
    </div>

    <div v-if="$parent.notification.googleSheetsCustomFormat" class="mb-3">
        <label for="google-sheets-columns" class="form-label">{{ $t("Column Names") }}</label>
        <input
            id="google-sheets-columns"
            v-model="$parent.notification.googleSheetsColumns"
            type="text"
            class="form-control"
            placeholder="timestamp,status,monitor,message,responsetime"
        />
        <div class="form-text">
            <p>{{ $t("Comma-separated column names. Available columns:") }}</p>
            <ul>
                <li><code>timestamp</code> - {{ $t("Current date and time") }}</li>
                <li><code>status</code> - {{ $t("UP/DOWN status") }}</li>
                <li><code>monitor</code> - {{ $t("Monitor name") }}</li>
                <li><code>url</code> - {{ $t("Monitor URL") }}</li>
                <li><code>message</code> - {{ $t("Notification message") }}</li>
                <li><code>responsetime</code> - {{ $t("Response time in ms") }}</li>
                <li><code>statuscode</code> - {{ $t("HTTP status code") }}</li>
            </ul>
        </div>
    </div>

    <div v-else class="mb-3">
        <div class="alert alert-info">
            {{ $t("Default columns: Timestamp, Status, Monitor Name, URL, Message, Response Time, Status Code") }}
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.googleSheetsSheetName === "undefined") {
            this.$parent.notification.googleSheetsSheetName = "Sheet1";
        }
        if (typeof this.$parent.notification.googleSheetsCustomFormat === "undefined") {
            this.$parent.notification.googleSheetsCustomFormat = false;
        }
        if (typeof this.$parent.notification.googleSheetsColumns === "undefined") {
            this.$parent.notification.googleSheetsColumns = "timestamp,status,monitor,message,responsetime";
        }
    },
};
</script>
