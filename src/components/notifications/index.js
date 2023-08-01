import Alerta from "./Alerta.vue";
import AlertNow from "./AlertNow.vue";
import AliyunSMS from "./AliyunSms.vue";
import Apprise from "./Apprise.vue";
import Bark from "./Bark.vue";
import ClickSendSMS from "./ClickSendSMS.vue";
import SMSC from "./SMSC.vue";
import DingDing from "./DingDing.vue";
import Discord from "./Discord.vue";
import Feishu from "./Feishu.vue";
import FreeMobile from "./FreeMobile.vue";
import GoogleChat from "./GoogleChat.vue";
import Gorush from "./Gorush.vue";
import Gotify from "./Gotify.vue";
import HomeAssistant from "./HomeAssistant.vue";
import Kook from "./Kook.vue";
import Line from "./Line.vue";
import LineNotify from "./LineNotify.vue";
import LunaSea from "./LunaSea.vue";
import Matrix from "./Matrix.vue";
import Mattermost from "./Mattermost.vue";
import Nostr from "./Nostr.vue";
import Ntfy from "./Ntfy.vue";
import Octopush from "./Octopush.vue";
import OneBot from "./OneBot.vue";
import Opsgenie from "./Opsgenie.vue";
import PagerDuty from "./PagerDuty.vue";
import FlashDuty from "./FlashDuty.vue";
import PagerTree from "./PagerTree.vue";
import PromoSMS from "./PromoSMS.vue";
import Pushbullet from "./Pushbullet.vue";
import PushDeer from "./PushDeer.vue";
import Pushover from "./Pushover.vue";
import Pushy from "./Pushy.vue";
import RocketChat from "./RocketChat.vue";
import ServerChan from "./ServerChan.vue";
import SerwerSMS from "./SerwerSMS.vue";
import Signal from "./Signal.vue";
import SMSManager from "./SMSManager.vue";
import Slack from "./Slack.vue";
import Squadcast from "./Squadcast.vue";
import SMSEagle from "./SMSEagle.vue";
import Stackfield from "./Stackfield.vue";
import STMP from "./SMTP.vue";
import Teams from "./Teams.vue";
import TechulusPush from "./TechulusPush.vue";
import Telegram from "./Telegram.vue";
import Twilio from "./Twilio.vue";
import Webhook from "./Webhook.vue";
import WeCom from "./WeCom.vue";
import GoAlert from "./GoAlert.vue";
import ZohoCliq from "./ZohoCliq.vue";
import Splunk from "./Splunk.vue";

/**
 * Manage all notification form.
 *
 * @type { Record<string, any> }
 */
const NotificationFormList = {
    "alerta": Alerta,
    "AlertNow": AlertNow,
    "AliyunSMS": AliyunSMS,
    "apprise": Apprise,
    "Bark": Bark,
    "clicksendsms": ClickSendSMS,
    "smsc": SMSC,
    "DingDing": DingDing,
    "discord": Discord,
    "Feishu": Feishu,
    "FreeMobile": FreeMobile,
    "GoogleChat": GoogleChat,
    "gorush": Gorush,
    "gotify": Gotify,
    "HomeAssistant": HomeAssistant,
    "Kook": Kook,
    "line": Line,
    "LineNotify": LineNotify,
    "lunasea": LunaSea,
    "matrix": Matrix,
    "mattermost": Mattermost,
    "nostr": Nostr,
    "ntfy": Ntfy,
    "octopush": Octopush,
    "OneBot": OneBot,
    "Opsgenie": Opsgenie,
    "PagerDuty": PagerDuty,
    "FlashDuty": FlashDuty,
    "PagerTree": PagerTree,
    "promosms": PromoSMS,
    "pushbullet": Pushbullet,
    "PushByTechulus": TechulusPush,
    "PushDeer": PushDeer,
    "pushover": Pushover,
    "pushy": Pushy,
    "rocket.chat": RocketChat,
    "serwersms": SerwerSMS,
    "signal": Signal,
    "SMSManager": SMSManager,
    "slack": Slack,
    "squadcast": Squadcast,
    "SMSEagle": SMSEagle,
    "smtp": STMP,
    "stackfield": Stackfield,
    "teams": Teams,
    "telegram": Telegram,
    "twilio": Twilio,
    "Splunk": Splunk,
    "webhook": Webhook,
    "WeCom": WeCom,
    "GoAlert": GoAlert,
    "ServerChan": ServerChan,
    "ZohoCliq": ZohoCliq
};

export default NotificationFormList;
