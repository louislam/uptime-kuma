import STMP from "./SMTP.vue"
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
import SerwerSMS from "./SerwerSMS.vue";
import Stackfield from './Stackfield.vue';
import GoogleChat from './GoogleChat.vue';

/**
 * Manage all notification form.
 *
 * @type { Record<string, any> }
 */
const NotificationFormList = {
    "AliyunSMS": AliyunSMS,
    "apprise": Apprise,
    "Bark": Bark,
    "clicksendsms": ClickSendSMS,
    "DingDing": DingDing,
    "discord": Discord,
    "smtp": STMP,
    "Feishu": Feishu,
    "Google Chat": GoogleChat,
    "gotify": Gotify,
    "line": Line,
    "lunasea": LunaSea,
    "matrix": Matrix,
    "mattermost": Mattermost,
    "octopush": Octopush,
    "promosms": PromoSMS,
    "pushbullet": Pushbullet,
    "pushover": Pushover,
    "pushy": Pushy,
    "rocket.chat": RocketChat,
    "serwersms": SerwerSMS,
    "signal": Signal,
    "slack": Slack,
    "stackfield": Stackfield,
    "teams": Teams,
    "telegram": Telegram,
    "webhook": Webhook
}

export default NotificationFormList
