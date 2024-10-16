<template>    
    <!-- SendGrid fields -->
    <div class="mb-3">
      <label for="sendgrid-api-key" class="form-label">{{ $t("SendGrid API Key") }}</label>
      <input id="sendgrid-api-key" v-model="$parent.notification.sendgridApiKey" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
      <label for="sendgrid-from-email" class="form-label">{{ $t("From Email") }}</label>
      <input id="sendgrid-from-email" v-model="$parent.notification.sendgridFromEmail" type="email" class="form-control" required>
    </div>
    <div class="mb-3">
      <label for="sendgrid-to-email" class="form-label">{{ $t("To Email") }}</label>
      <input id="sendgrid-to-email" v-model="$parent.notification.sendgridToEmail" type="email" class="form-control" required>
    </div>
    <div class="mb-3">
      <label for="sendgrid-cc-email" class="form-label">{{ $t("CC Email") }}</label>
      <input id="sendgrid-cc-email" v-model="$parent.notification.sendgridCcEmail" type="email" class="form-control">
      <small class="form-text text-muted">{{ $t("Separate multiple email addresses with commas") }}</small>
    </div>
    <div class="mb-3">
      <label for="sendgrid-bcc-email" class="form-label">{{ $t("BCC Email") }}</label>
      <input id="sendgrid-bcc-email" v-model="$parent.notification.sendgridBccEmail" type="email" class="form-control">
      <small class="form-text text-muted">{{ $t("Separate multiple email addresses with commas") }}</small>
    </div>
    <div class="mb-3">
      <label for="sendgrid-subject" class="form-label">{{ $t("Email Subject") }}</label>
      <input id="sendgrid-subject" v-model="$parent.notification.sendgridSubject" type="text" class="form-control" required>
      <small class="form-text text-muted">{{ $t("Default subject will be used if left empty") }}</small>
    </div>
    <div class="mb-3">
      <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://docs.sendgrid.com/api-reference/mail-send/mail-send" target="_blank">https://docs.sendgrid.com/api-reference/mail-send/mail-send</a>
      </i18n-t>
    </div>
  </template>
