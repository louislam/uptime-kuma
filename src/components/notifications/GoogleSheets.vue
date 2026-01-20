<template>
    <div class="mb-3">
        <label for="google-sheets-webhook-url" class="form-label">{{ $t("Google Apps Script Webhook URL") }}</label>
        <input
            id="google-sheets-webhook-url"
            v-model="$parent.notification.googleSheetsWebhookUrl"
            type="text"
            class="form-control"
            required
            placeholder="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
        />
        <div class="form-text">
            <p>{{ $t("Deploy a Google Apps Script as a web app and paste the URL here") }}</p>
        </div>
    </div>

    <div class="alert alert-info" style="border-radius: 8px;">
        <h6 style="margin-bottom: 12px; font-weight: 600;">{{ $t("Quick Setup Guide") }}:</h6>
        <ol style="margin-bottom: 0; padding-left: 20px; line-height: 1.8;">
            <li>{{ $t("Open your Google Spreadsheet") }}</li>
            <li>{{ $t("Go to Extensions → Apps Script") }}</li>
            <li>{{ $t("Paste the script code (see below)") }}</li>
            <li>{{ $t("Click Deploy → New deployment → Web app") }}</li>
            <li>{{ $t("Set 'Execute as: Me' and 'Who has access: Anyone'") }}</li>
            <li>{{ $t("Copy the web app URL and paste it above") }}</li>
        </ol>
    </div>

    <div class="mb-3">
        <button 
            type="button" 
            class="btn btn-secondary btn-sm" 
            @click="showScript = !showScript"
        >
            {{ showScript ? $t("Hide Script Code") : $t("Show Script Code") }}
        </button>
    </div>

    <div v-if="showScript" class="mb-3">
        <label class="form-label">{{ $t("Google Apps Script Code") }}:</label>
        <textarea 
            readonly 
            class="form-control" 
            rows="15" 
            style="font-family: monospace; font-size: 12px;"
        >function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // Add header row if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Status', 'Monitor Name', 'URL', 'Message', 'Response Time', 'Status Code']);
  }
  
  // Add data row
  sheet.appendRow([
    data.timestamp,
    data.status,
    data.monitorName,
    data.monitorUrl,
    data.message,
    data.responseTime,
    data.statusCode
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({result: 'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}</textarea>
        <button 
            type="button" 
            class="btn btn-outline-secondary btn-sm mt-2" 
            @click="copyScript"
        >
            {{ $t("Copy to Clipboard") }}
        </button>
    </div>
</template>

<script>
export default {
    data() {
        return {
            showScript: false
        };
    },
    methods: {
        copyScript() {
            const scriptCode = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // Add header row if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Status', 'Monitor Name', 'URL', 'Message', 'Response Time', 'Status Code']);
  }
  
  // Add data row
  sheet.appendRow([
    data.timestamp,
    data.status,
    data.monitorName,
    data.monitorUrl,
    data.message,
    data.responseTime,
    data.statusCode
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({result: 'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}`;
            try {
                navigator.clipboard.writeText(scriptCode);
                alert(this.$t("Copied to clipboard!"));
            } catch (error) {
                alert(this.$t("Failed to copy to clipboard"));
            }
        }
    }
};
</script>
