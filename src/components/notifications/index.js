import STMP from "./SMTP.vue";
import Telegram from "./Telegram.vue";
import Discord from "./Discord.vue";
import Webhook from "./Webhook.vue";
import Signal from "./Signal.vue";
import Gotify from "./Gotify.vue";
import Slack from "./Slack.vue";
import RocketChat from "./RocketChat.vue";
import Teams from "./Teams.vue";
import Pushover from "./Pushover.vue";
import Pushy from "./Pushy.vue";
import Octopush from "./Octopush.vue";
import PromoSMS from "./PromoSMS.vue";
import ClickSendSMS from "./ClickSendSMS.vue";
import LunaSea from "./LunaSea.vue";
import Feishu from "./Feishu.vue";
import Apprise from "./Apprise.vue";
import Pushbullet from "./Pushbullet.vue";
import Line from "./Line.vue";
import Mattermost from "./Mattermost.vue";
import Matrix from "./Matrix.vue";
import AliyunSMS from "./AliyunSms.vue";
import DingDing from "./DingDing.vue";
import Bark from "./Bark.vue";

/**
 * Manage all notification form.
 *
 * @type { Record<string, any> }
 */
const getNotificationFormList = ($t) => ({
    "telegram": {
        component: Telegram,
        label: $t("telegram")
    },
    "webhook": {
        component: Webhook,
        label: $t("webhook"),
    },
    "smtp": {
        component: STMP,
        label: $t("smtp"),
    },
    "discord": {
        component: Discord,
        label: $t("discord"),
    },
    "teams": {
        component: Teams,
        label: $t("teams"),
    },
    "signal": {
        component: Signal,
        label: $t("signal"),
    },
    "gotify": {
        component: Gotify,
        label: $t("gotify"),
    },
    "slack": {
        component: Slack,
        label: $t("slack"),
    },
    "rocket.chat": {
        component: RocketChat,
        label: $t("rocket.chat"),
    },
    "pushover": {
        component: Pushover,
        label: $t("pushover"),
    },
    "pushy": {
        component: Pushy,
        label: $t("pushy"),
    },
    "octopush": {
        component: Octopush,
        label: $t("octopush"),
    },
    "promosms": {
        component: PromoSMS,
        label: $t("promosms"),
    },
    "clicksendsms": {
        component: ClickSendSMS,
        label: $t("clicksendsms"),
    },
    "lunasea": {
        component: LunaSea,
        label: $t("lunasea"),
    },
    "Feishu": {
        component: Feishu,
        label: $t("Feishu"),
    },
    "AliyunSMS": {
        component: AliyunSMS,
        label: $t("AliyunSMS"),
    },
    "apprise": {
        component: Apprise,
        label: $t("apprise"),
    },
    "pushbullet": {
        component: Pushbullet,
        label: $t("pushbullet"),
    },
    "line": {
        component: Line,
        label: $t("line"),
    },
    "mattermost": {
        component: Mattermost,
        label: $t("mattermost"),
    },
    "matrix": {
        component: Matrix,
        label: $t("matrix"),
    },
    "DingDing": {
        component: DingDing,
        label: $t("DingDing"),
    },
    "Bark": {
        component: Bark,
        label: $t("Bark"),
    }
});

export default getNotificationFormList;
