<template>
    <div class="mb-3">
        <div class="alert alert-info mb-3">
            <i class="fas fa-info-circle"></i>
            <strong>Slack Group Summary</strong> - This notification aggregates response times and status
            from all monitors in a specific group and sends a formatted summary to Slack.
            <br><br>
            <strong>Use case:</strong> Send periodic summaries of results showing total successful/failed
            responses, average response time, and individual monitor response times.
        </div>

        <label for="slack-group-summary-webhook-url" class="form-label">
            {{ $t("Webhook URL") }}<span style="color: red;"><sup>*</sup></span>
        </label>
        <input
            id="slack-group-summary-webhook-url"
            v-model="$parent.notification.slackGroupSummaryWebhookURL"
            type="text"
            class="form-control"
            placeholder="https://hooks.slack.com/services/..."
            required
        >
        <div class="form-text">
            Slack incoming webhook URL for sending summaries.
        </div>

        <hr class="my-4">
        <h6>Group Configuration</h6>

        <label for="slack-group-summary-group-id" class="form-label">
            Target Group ID (Optional)
        </label>
        <input
            id="slack-group-summary-group-id"
            v-model="$parent.notification.slackGroupSummaryGroupId"
            type="number"
            class="form-control"
            placeholder="e.g., 5"
        >
        <div class="form-text">
            Only aggregate monitors from this specific group ID. Leave empty for all monitors.
            You can find the group ID in the URL when editing a group.
        </div>

        <label for="slack-group-summary-group-name" class="form-label">
            Group Display Name
        </label>
        <input
            id="slack-group-summary-group-name"
            v-model="$parent.notification.slackGroupSummaryGroupName"
            type="text"
            class="form-control"
            placeholder="e.g., Conversion Tests"
        >
        <div class="form-text">
            Name displayed in the Slack summary header.
        </div>

        <hr class="my-4">
        <h6>Aggregation Settings</h6>

        <label for="slack-group-summary-min-monitors" class="form-label">
            Minimum Monitors Before Sending
        </label>
        <input
            id="slack-group-summary-min-monitors"
            v-model="$parent.notification.slackGroupSummaryMinMonitors"
            type="number"
            class="form-control"
            placeholder="1"
            min="1"
        >
        <div class="form-text">
            Wait until this many monitors have reported before sending summary.
            Set this to the number of monitors in your group for complete summaries.
        </div>

        <label for="slack-group-summary-interval" class="form-label">
            Summary Interval
        </label>
        <select
            id="slack-group-summary-interval"
            v-model="$parent.notification.slackGroupSummaryInterval"
            class="form-select"
        >
            <option :value="300000">Every 5 minutes</option>
            <option :value="600000">Every 10 minutes</option>
            <option :value="900000">Every 15 minutes</option>
            <option :value="1800000">Every 30 minutes</option>
            <option :value="3600000">Every 1 hour</option>
            <option :value="7200000">Every 2 hours</option>
            <option :value="14400000">Every 4 hours</option>
            <option :value="21600000">Every 6 hours</option>
            <option :value="43200000">Every 12 hours</option>
            <option :value="86400000">Every 24 hours</option>
        </select>
        <div class="form-text">
            How often to send the group summary report to Slack.
        </div>

        <hr class="my-4">
        <h6>Slack Display Settings</h6>

        <label for="slack-group-summary-channel" class="form-label">
            Channel Name (Optional)
        </label>
        <input
            id="slack-group-summary-channel"
            v-model="$parent.notification.slackGroupSummaryChannel"
            type="text"
            class="form-control"
            placeholder="#monitoring-results"
        >
        <div class="form-text">
            Override the default webhook channel. Include the # prefix.
        </div>

        <label for="slack-group-summary-username" class="form-label">
            Bot Username (Optional)
        </label>
        <input
            id="slack-group-summary-username"
            v-model="$parent.notification.slackGroupSummaryUsername"
            type="text"
            class="form-control"
            placeholder="APEX Office Print Monitor"
        >
        <div class="form-text">
            Custom username for the bot posting the summary.
        </div>

        <label for="slack-group-summary-icon-emoji" class="form-label">
            Icon Emoji (Optional)
        </label>
        <input
            id="slack-group-summary-icon-emoji"
            v-model="$parent.notification.slackGroupSummaryIconEmoji"
            type="text"
            class="form-control"
            placeholder=":chart_with_upwards_trend:"
        >
        <div class="form-text">
            Custom emoji icon for the bot. Use Slack emoji format like :robot_face:
        </div>

        <div class="form-text mt-4">
            <span style="color: red;"><sup>*</sup></span> Required
            <p style="margin-top: 8px;">
                <strong>How it works:</strong>
            </p>
            <ol>
                <li>Each time a monitor sends a heartbeat, this provider collects the response time and status.</li>
                <li>Once the minimum number of monitors have reported, a summary is sent to Slack.</li>
                <li>The summary includes total successful/failed counts, average response time, and a table of individual results.</li>
            </ol>
        </div>
    </div>
</template>

<script>
export default {
    name: "SlackGroupSummary",
    mounted() {
        // Set defaults if not already set
        if (!this.$parent.notification.slackGroupSummaryMinMonitors) {
            this.$parent.notification.slackGroupSummaryMinMonitors = 1;
        }
        if (!this.$parent.notification.slackGroupSummaryInterval) {
            this.$parent.notification.slackGroupSummaryInterval = 3600000;
        }
        if (!this.$parent.notification.slackGroupSummaryGroupName) {
            this.$parent.notification.slackGroupSummaryGroupName = "Monitors";
        }
    }
};
</script>
