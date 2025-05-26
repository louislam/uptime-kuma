import Alerta from "./Alerta.vue";
import AlertNow from "./AlertNow.vue";
import AliyunSMS from "./AliyunSms.vue";
import Apprise from "./Apprise.vue";
import Bark from "./Bark.vue";
import Bitrix24 from "./Bitrix24.vue";
import Notifery from "./Notifery.vue";
import ClickSendSMS from "./ClickSendSMS.vue";
import CallMeBot from "./CallMeBot.vue";
import SMSC from "./SMSC.vue";
import DingDing from "./DingDing.vue";
import Discord from "./Discord.vue";
import Elks from "./46elks.vue";
import Feishu from "./Feishu.vue";
import FreeMobile from "./FreeMobile.vue";
import GoogleChat from "./GoogleChat.vue";
import Gorush from "./Gorush.vue";
import Gotify from "./Gotify.vue";
import GrafanaOncall from "./GrafanaOncall.vue";
import GtxMessaging from "./GtxMessaging.vue";
import HomeAssistant from "./HomeAssistant.vue";
import HeiiOnCall from "./HeiiOnCall.vue";
import Keep from "./Keep.vue";
import Kook from "./Kook.vue";
import Line from "./Line.vue";
import LineNotify from "./LineNotify.vue";
import LunaSea from "./LunaSea.vue";
import Matrix from "./Matrix.vue";
import Mattermost from "./Mattermost.vue";
import Nostr from "./Nostr.vue";
import Ntfy from "./Ntfy.vue";
import Octopush from "./Octopush.vue";
import OneChat from "./OneChat.vue";
import OneBot from "./OneBot.vue";
import Onesender from "./Onesender.vue";
import Opsgenie from "./Opsgenie.vue";
import PagerDuty from "./PagerDuty.vue";
import FlashDuty from "./FlashDuty.vue";
import PagerTree from "./PagerTree.vue";
import PromoSMS from "./PromoSMS.vue";
import Pumble from "./Pumble.vue";
import Pushbullet from "./Pushbullet.vue";
import PushDeer from "./PushDeer.vue";
import Pushover from "./Pushover.vue";
import PushPlus from "./PushPlus.vue";
import Pushy from "./Pushy.vue";
import RocketChat from "./RocketChat.vue";
import ServerChan from "./ServerChan.vue";
import SerwerSMS from "./SerwerSMS.vue";
import Signal from "./Signal.vue";
import SMSManager from "./SMSManager.vue";
import SMSPartner from "./SMSPartner.vue";
import Slack from "./Slack.vue";
import Squadcast from "./Squadcast.vue";
import SMSEagle from "./SMSEagle.vue";
import Stackfield from "./Stackfield.vue";
import STMP from "./SMTP.vue";
import Teams from "./Teams.vue";
import TechulusPush from "./TechulusPush.vue";
import Telegram from "./Telegram.vue";
import Threema from "./Threema.vue";
import Twilio from "./Twilio.vue";
import Webhook from "./Webhook.vue";
import WeCom from "./WeCom.vue";
import GoAlert from "./GoAlert.vue";
import ZohoCliq from "./ZohoCliq.vue";
import Splunk from "./Splunk.vue";
import SpugPush from "./SpugPush.vue";
import SevenIO from "./SevenIO.vue";
import Whapi from "./Whapi.vue";
import WAHA from "./WAHA.vue";
import Cellsynt from "./Cellsynt.vue";
import WPush from "./WPush.vue";
import SIGNL4 from "./SIGNL4.vue";
import SendGrid from "./SendGrid.vue";
import YZJ from "./YZJ.vue";
import SMSPlanet from "./SMSPlanet.vue";

/**
 * Manage all notification form.
 * @type { Record<string, any> }
 */
const NotificationFormList = {
    "alerta": Alerta,
    "AlertNow": AlertNow,
    "AliyunSMS": AliyunSMS,
    "apprise": Apprise,
    "Bark": Bark,
    "Bitrix24": Bitrix24,
    "clicksendsms": ClickSendSMS,
    "CallMeBot": CallMeBot,
    "smsc": SMSC,
    "DingDing": DingDing,
    "discord": Discord,
    "Elks": Elks,
    "Feishu": Feishu,
    "FreeMobile": FreeMobile,
    "GoogleChat": GoogleChat,
    "gorush": Gorush,
    "gotify": Gotify,
    "GrafanaOncall": GrafanaOncall,
    "HomeAssistant": HomeAssistant,
    "HeiiOnCall": HeiiOnCall,
    "Keep": Keep,
    "Kook": Kook,
    "line": Line,
    "LineNotify": LineNotify,
    "lunasea": LunaSea,
    "matrix": Matrix,
    "mattermost": Mattermost,
    "nostr": Nostr,
    "ntfy": Ntfy,
    "octopush": Octopush,
    "OneChat": OneChat,
    "OneBot": OneBot,
    "Onesender": Onesender,
    "Opsgenie": Opsgenie,
    "PagerDuty": PagerDuty,
    "FlashDuty": FlashDuty,
    "PagerTree": PagerTree,
    "promosms": PromoSMS,
    "pumble": Pumble,
    "pushbullet": Pushbullet,
    "PushByTechulus": TechulusPush,
    "PushDeer": PushDeer,
    "pushover": Pushover,
    "PushPlus": PushPlus,
    "pushy": Pushy,
    "rocket.chat": RocketChat,
    "serwersms": SerwerSMS,
    "signal": Signal,
    "SIGNL4": SIGNL4,
    "SMSManager": SMSManager,
    "SMSPartner": SMSPartner,
    "slack": Slack,
    "squadcast": Squadcast,
    "SMSEagle": SMSEagle,
    "smtp": STMP,
    "stackfield": Stackfield,
    "teams": Teams,
    "telegram": Telegram,
    "threema": Threema,
    "twilio": Twilio,
    "Splunk": Splunk,
    "SpugPush": SpugPush,
    "webhook": Webhook,
    "WeCom": WeCom,
    "GoAlert": GoAlert,
    "ServerChan": ServerChan,
    "ZohoCliq": ZohoCliq,
    "SevenIO": SevenIO,
    "whapi": Whapi,
    "notifery": Notifery,
    "waha": WAHA,
    "gtxmessaging": GtxMessaging,
    "Cellsynt": Cellsynt,
    "WPush": WPush,
    "SendGrid": SendGrid,
    "YZJ": YZJ,
    "SMSPlanet": SMSPlanet,
};

export default NotificationFormList;
