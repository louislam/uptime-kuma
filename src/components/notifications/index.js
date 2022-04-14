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
import TechulusPush from "./TechulusPush.vue";
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
import Stackfield from "./Stackfield.vue";
import WeCom from "./WeCom.vue";
import GoogleChat from "./GoogleChat.vue";
import Gorush from "./Gorush.vue";
import Alerta from "./Alerta.vue";
import OneBot from "./OneBot.vue";
import PushDeer from "./PushDeer.vue";

/**
 * Manage all notification form.
 *
 * @type { Record<string, any> }
 */
const NotificationFormList = {
    "telegram": Telegram,
    "webhook": Webhook,
    "smtp": STMP,
    "discord": Discord,
    "teams": Teams,
    "signal": Signal,
    "gotify": Gotify,
    "slack": Slack,
    "rocket.chat": RocketChat,
    "pushover": Pushover,
    "pushy": Pushy,
    "PushByTechulus": TechulusPush,
    "octopush": Octopush,
    "promosms": PromoSMS,
    "clicksendsms": ClickSendSMS,
    "lunasea": LunaSea,
    "Feishu": Feishu,
    "AliyunSMS": AliyunSMS,
    "apprise": Apprise,
    "pushbullet": Pushbullet,
    "line": Line,
    "mattermost": Mattermost,
    "matrix": Matrix,
    "DingDing": DingDing,
    "Bark": Bark,
    "serwersms": SerwerSMS,
    "stackfield": Stackfield,
    "WeCom": WeCom,
    "GoogleChat": GoogleChat,
    "gorush": Gorush,
    "alerta": Alerta,
    "OneBot": OneBot,
    "PushDeer": PushDeer,
};

export default NotificationFormList;
