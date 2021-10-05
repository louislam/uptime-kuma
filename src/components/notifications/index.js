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
import LunaSea from "./LunaSea.vue";
import Apprise from "./Apprise.vue";
import Pushbullet from "./Pushbullet.vue";
import Line from "./Line.vue";
import Mattermost from "./Mattermost.vue";
import Matrix from "./Matrix.vue";

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
    "octopush": Octopush,
    "lunasea": LunaSea,
    "apprise": Apprise,
    "pushbullet": Pushbullet,
    "line": Line,
    "mattermost": Mattermost,
    "matrix": Matrix
}

export default NotificationFormList
