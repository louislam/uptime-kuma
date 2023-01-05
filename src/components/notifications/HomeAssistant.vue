<template>
    <div class="mb-3">
        <label for="homeAssistantUrl" class="form-label">{{ $t("Home Assistant URL") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="homeAssistantUrl" v-model="$parent.notification.homeAssistantUrl" type="url" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="longLivedAccessToken" class="form-label">{{ $t("Long-Lived Access Token") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="longLivedAccessToken" v-model="$parent.notification.longLivedAccessToken" type="text" class="form-control" required>

        <div class="form-text">
            <p>{{ $t("Long-Lived Access Token can be created by clicking on your profile name (bottom left) and scrolling to the bottom then click Create Token. ") }}</p>
        </div>
    </div>

    <div class="mb-3">
        <label for="notificationService" class="form-label">{{ $t("Notification Service") }}</label>
        <input id="notificationService" v-model="$parent.notification.notificationService" type="text" :placeholder="$t('default: notify all devices')" class="form-control">

        <div class="form-text">
            <p>{{ $t('A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.') }}</p>
            <p>{{ $t("Automations can optionally be triggered in Home Assistant:") }}</p>
            <p>
                {{ $t("Trigger type:") }} <code>Event</code><br />
                {{ $t("Event type:") }} <code>call_service</code><br />
                {{ $t("Event data:") }}
            </p>
            <pre>domain: notify
service: mobile_app_my_phone # change to your device name
service_data:
  title: Uptime Kuma
  data:
    status: 0 # 0=down 1=up
    # name: Optional Uptime Kuma Monitor Name to filter by</pre>
            <p>
                {{ $t("Then choose an action, for example switch the scene to where an RGB light is red.") }}
            </p>
        </div>
    </div>
</template>
