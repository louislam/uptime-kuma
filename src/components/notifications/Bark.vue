<template>
    <div class="mb-3">
        <label for="Bark Endpoint" class="form-label">{{ $t("Bark Endpoint") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="Bark Endpoint" v-model="$parent.notification.barkEndpoint" type="text" class="form-control" required>
        <div class="form-text">
            <p><span style="color: red;"><sup>*</sup></span>{{ $t("Required") }}</p>
        </div>
        <i18n-t tag="div" keypath="wayToGetTeamsURL" class="form-text">
            <a
                href="https://github.com/Finb/Bark"
                target="_blank"
            >{{ $t("here") }}</a>
        </i18n-t>
    </div>
</template>
