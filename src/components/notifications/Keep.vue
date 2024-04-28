<template>
  <div class="mb-3">
      <label for="webhook-url" class="form-label">{{ $t("Host URL") }}</label>
      <input
          id="webhook-url"
          v-model="$parent.notification.webhookURL"
          type="url"
          pattern="https?://.+"
          class="form-control"
          required
      />
  </div>

  <div class="mb-3">
      <label for="webhook-apikey" class="form-label">{{ $t("API Key") }}</label>
      <input
          id="webhook-apikey"
          v-model="$parent.notification.webhookAPIKey"
          type="text"
          class="form-control"
          required
      />
  </div>
</template>

<script>
export default {
  computed: {
      headersPlaceholder() {
          return this.$t("Example:", [
`{
  "Authorization": "Authorization Token"
}`,
          ]);
      },
      customBodyPlaceholder() {
          return this.$t("Example:", [
`{
  "Title": "Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}",
  "Body": "{{ msg }}"
}`
          ]);
      }
  },
};
</script>

<style lang="scss" scoped>
textarea {
  min-height: 200px;
}
</style>
