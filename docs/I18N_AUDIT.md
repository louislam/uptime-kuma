# i18n audit

Source of truth: `src/lang/en.json`

## Summary

- Locales audited: **76**
- Orphan keys pruned across all locales: **3135**
- Missing keys across all locales (translation gaps; not auto-filled): **60535**
- Placeholder mismatches: **136**
- In-file duplicate keys detected: **0**

Missing keys are *not* auto-filled with English. vue-i18n falls back to en at runtime, and auto-filling would mark untranslated strings as translated, which would confuse Weblate sync.

## Top offenders by missing-key count

| Locale | Language | Missing | Orphans pruned | Placeholder mismatches |
|---|---|---:|---:|---:|
| `ab` |  | 1536 | 0 | 0 |
| `enm` |  | 1536 | 0 | 0 |
| `lzh` |  | 1536 | 0 | 0 |
| `ne` |  | 1536 | 0 | 0 |
| `ug` |  | 1536 | 0 | 0 |
| `ang` |  | 1535 | 0 | 0 |
| `he` | עברית | 1533 | 0 | 0 |
| `pa` | پنجابی | 1531 | 0 | 0 |
| `xh` |  | 1531 | 0 | 0 |
| `ca@valencia` |  | 1526 | 0 | 0 |
| `pa_PK` | ਅੰਗਰੇਜ਼ੀ | 1526 | 0 | 0 |
| `zu` | IsiNgisi | 1525 | 0 | 0 |
| `gl` | Galego | 1515 | 0 | 0 |
| `ckb` | کوردی | 1497 | 5 | 0 |
| `ml` | മലയാളം | 1489 | 3 | 0 |

## Per-locale detail

### `ab` — (no languageName)

- Missing keys: **1536**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `af` — Afrikaans

- Missing keys: **1478**
- Orphan keys pruned: **6**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`

</details>

### `ang` — (no languageName)

- Missing keys: **1535**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `ar-SY` — العربية

- Missing keys: **892**
- Orphan keys pruned: **72**
- Type mismatches: **0**
- Placeholder mismatches: **7**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `atLeastOneMonitor`
- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `ZohoCliq`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `Kook`
- `line`
- `mattermost`
- `More info on`
- `checkPrice`
- `Example`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `smseagle`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Accept characters`
- `Don't know how to get the token? Please read the guide`
- `Subject`
- `Valid To`
- `Days Remaining`
- `Issuer`
- `Fingerprint`
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Most likely causes`
- `What you can try`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Automations can optionally be triggered in Home Assistant`
- `Trigger type`
- `Event type`
- `Event data`
- `Frontend Version`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`

</details>

Placeholder mismatches:
- `needPushEvery` — en: `{0}` · locale: `(none)`
- `pushOptionalParams` — en: `{0}` · locale: `(none)`
- `defaultNotificationName` — en: `{notification} {number}` · locale: `{number}`
- `webhookFormDataDesc` — en: `{decodeFunction} {multipart}` · locale: `{decodefunction} {multipart}`
- `aboutWebhooks` — en: `{0}` · locale: `(none)`
- `emojiCheatSheet` — en: `{0}` · locale: `(none)`
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `ar` — العربية

- Missing keys: **722**
- Orphan keys pruned: **32**
- Type mismatches: **0**
- Placeholder mismatches: **7**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`
- `Last Updated`
- `Unpin`
- `Version`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Certificate Chain`
- `Date Created`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `atLeastOneMonitor`
- `endpoint`
- `checkPrice`
- `You can divide numbers with`
- `Sms template must contain parameters: `
- `Legacy Octopush-DM`
- `selectedMonitorCount`
- `emailTemplateStatus`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `-year`

</details>

Placeholder mismatches:
- `needPushEvery` — en: `{0}` · locale: `(none)`
- `pushOptionalParams` — en: `{0}` · locale: `(none)`
- `defaultNotificationName` — en: `{notification} {number}` · locale: `{number}`
- `webhookFormDataDesc` — en: `{decodeFunction} {multipart}` · locale: `{decodefunction} {multipart}`
- `emojiCheatSheet` — en: `{0}` · locale: `(none)`
- `aboutWebhooks` — en: `{0}` · locale: `(none)`
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `bar` — Deutsch (Bayern)

- Missing keys: **109**
- Orphan keys pruned: **64**
- Type mismatches: **0**
- Placeholder mismatches: **12**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `steamApiKeyDescription`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Monitor`
- `day`
- `-day`
- `hour`
- `Version`
- `-hour`
- `Advanced Message Queuing Protocol`
- `Broadband Forum User Services Platform`
- `Extensible Messaging and Presence Protocol`
- `BACnet Secure Connect Direct Connection`
- `Penguin Statistics Live Protocol v3`
- `HeadersInvalidFormat`
- `Session Initiation Protocol`
- `WebSocket Application Messaging Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Smart Home IP`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `WebSocket Transport for JMAP`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Collection Update`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `BodyInvalidFormat`
- `-year`
- `Current User`
- `Created`
- `Last Updated`
- `selectedMonitorCount`
- `Certificate Chain`
- `Date Created`
- `Notification Service`
- `Frontend Version`
- `cronSchedule`
- `Examples`
- `Subprotocol`
- `checkPrice`
- `atLeastOneMonitor`
- `year`
- `endpoint`
- `domain_expiry_unsupported_invalid_domain`
- `domain_expiry_unsupported_public_suffix`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_is_ip`
- `You can divide numbers with`
- `GlobalpingDescription`
- `GlobalpingLocation`

</details>

Placeholder mismatches:
- `legacyOctopushEndpoint` — en: `{url}` · locale: `(none)`
- `octopushEndpoint` — en: `{url}` · locale: `(none)`
- `Monitor Setting` — en: `{0}` · locale: `(none)`
- `aboutJiraCloudId` — en: `{0}` · locale: `(none)`
- `Badge Link Generator` — en: `{0}` · locale: `(none)`
- `cacheBusterParam` — en: `{0}` · locale: `(none)`
- `foundChromiumVersion` — en: `{0}` · locale: `(none)`
- `Screenshot Delay` — en: `{milliseconds}` · locale: `(none)`
- `systemServiceExpectedOutput` — en: `{0}` · locale: `(none)`
- `documentationOf` — en: `{0}` · locale: `(none)`
- `milliseconds` — en: `{n}` · locale: `(none)`
- `systemServiceCommandHint` — en: `{command}` · locale: `(none)`

### `be` — Беларуская

- Missing keys: **593**
- Orphan keys pruned: **33**
- Type mismatches: **0**
- Placeholder mismatches: **5**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `-hour`
- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `selectedMonitorCount`
- `shrinkDatabaseDescription`
- `Certificate Chain`
- `Date Created`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `cronSchedule`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `atLeastOneMonitor`
- `endpoint`
- `checkPrice`
- `You can divide numbers with`
- `Sms template must contain parameters: `
- `Legacy Octopush-DM`
- `Open Badge Generator`
- `Badge Generator`
- `-year`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `wayToGetPagerTreeIntegrationURL` — en: `{0}` · locale: `{0} {Endpoint}`
- `callMeBotGet` — en: `{0} {1} {2} {3}` · locale: `{0} {1} {2} {3} {endpoint}`
- `cellsyntOriginator` — en: `(none)` · locale: `{originatortype}`
- `Either enter the hostname of the server you want to connect to or localhost if you intend to use a locally configured mail transfer agent` — en: `{local_mta} {localhost}` · locale: `{Hostname} {local_mta} {localhost}`

### `bg-BG` — Български

- Missing keys: **2**
- Orphan keys pruned: **116**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `clicksendsms`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `PushByTechulus`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `successMessage`
- `successMessageExplanation`
- `Date Created`
- `Legacy Octopush-DM`
- `endpoint`
- `HomeAssistant`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `atLeastOneMonitor`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `smseagle`
- `ZohoCliq`
- `Kook`
- `Monitor`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Generator`
- `Badge Duration`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `CurlDebugInfo`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CurlDebugInfoProxiesUnsupported`
- `Network API for Notification Channel`
- `Extensible Messaging and Presence Protocol`
- `Softvelum Low Delay Protocol`
- `Declarative Resource Protocol`
- `WebSocket Transport for JMAP`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Cobra Real Time Messaging Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Collection Update`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Penguin Statistics Live Protocol v3`
- `Subprotocol`
- `year`
- `domain_expiry_unsupported_invalid_domain`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_public_suffix`
- `domain_expiry_unsupported_is_ip`
- `GlobalpingDescription`
- `GlobalpingLocation`

</details>

### `bn` — বাংলা

- Missing keys: **387**
- Orphan keys pruned: **29**
- Type mismatches: **0**
- Placeholder mismatches: **8**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `-day`
- `hour`
- `Monitor`
- `day`
- `-hour`
- `-year`
- `atLeastOneMonitor`
- `endpoint`
- `checkPrice`
- `Date Created`
- `BodyInvalidFormat`
- `Current User`
- `Created`
- `HeadersInvalidFormat`
- `steamApiKeyDescription`
- `Last Updated`
- `Certificate Chain`
- `selectedMonitorCount`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `cronSchedule`
- `Legacy Octopush-DM`
- `You can divide numbers with`
- `Open Badge Generator`
- `Badge Generator`
- `Sms template must contain parameters: `

</details>

Placeholder mismatches:
- `defaultNotificationName` — en: `{notification} {number}` · locale: `{number}`
- `time ago` — en: `{0}` · locale: `(none)`
- `telegramServerUrlDescription` — en: `{0} {1}` · locale: `{0}`
- `Mention group` — en: `{group}` · locale: `(none)`
- `Invalid mobile` — en: `{mobile}` · locale: `(none)`
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `mongodbCommandDescription` — en: `{documentation}` · locale: `(none)`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `(none)`

### `ca` — Català

- Missing keys: **902**
- Orphan keys pruned: **39**
- Type mismatches: **0**
- Placeholder mismatches: **3**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`
- `-year`
- `Current User`
- `Created`
- `Last Updated`
- `Certificate Chain`
- `Date Created`
- `Examples`
- `Notification Service`
- `Frontend Version`
- `cronSchedule`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `steamApiKeyDescription`
- `selectedMonitorCount`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `atLeastOneMonitor`
- `endpoint`
- `Advanced Message Queuing Protocol`
- `Miele Cloud Connect Protocol`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`

</details>

Placeholder mismatches:
- `statusPageRefreshIn` — en: `{0}` · locale: `(none)`
- `shrinkDatabaseDescriptionSqlite` — en: `{auto_vacuum} {vacuum}` · locale: `{vacuum}`
- `wsSubprotocolDescription` — en: `{documentation}` · locale: `(none)`

### `ca@valencia` — (no languageName)

- Missing keys: **1526**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `ckb` — کوردی

- Missing keys: **1497**
- Orphan keys pruned: **5**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `Monitor`

</details>

### `cs-CZ` — Čeština

- Missing keys: **2**
- Orphan keys pruned: **72**
- Type mismatches: **0**
- Placeholder mismatches: **3**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `atLeastOneMonitor`
- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `ZohoCliq`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `Kook`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `smseagle`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Duration`
- `Badge Generator`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `Debug`
- `CopyToClipboardError`
- `Copy`
- `domain_expiry_unsupported_is_ip`
- `domain_expiry_public_suffix_too_short`

</details>

Placeholder mismatches:
- `defaultNotificationName` — en: `{notification} {number}` · locale: `{notification}`
- `mongodbCommandDescription` — en: `{documentation}` · locale: `{dokumentaci}`
- `Mention group` — en: `{group}` · locale: `(none)`

### `da-DK` — Dansk

- Missing keys: **766**
- Orphan keys pruned: **52**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Also apply to existing monitors`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `clicksendsms`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `Examples`
- `successMessage`
- `Certificate Chain`
- `Frontend Version`
- `Notification Service`
- `HomeAssistant`
- `Monitor`
- `Date Created`
- `selectedMonitorCount`
- `You can divide numbers with`
- `atLeastOneMonitor`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `cronSchedule`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `endpoint`
- `-year`
- `year`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `de-CH` — Deutsch (Schweiz)

- Missing keys: **352**
- Orphan keys pruned: **105**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `clicksendsms`
- `PushByTechulus`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `successMessage`
- `successMessageExplanation`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `atLeastOneMonitor`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `Monitor`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Generator`
- `Badge Duration`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `Debug`
- `Copy`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `CurlDebugInfo`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoProxiesUnsupported`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `WebSocket Transport for JMAP`
- `BACnet Secure Connect Direct Connection`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Collection Update`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Penguin Statistics Live Protocol v3`

</details>

Placeholder mismatches:
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `{Dokumentation}`

### `de-DE` — Deutsch

- Missing keys: **46**
- Orphan keys pruned: **113**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `clicksendsms`
- `PushByTechulus`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `successMessage`
- `successMessageExplanation`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `atLeastOneMonitor`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `ZohoCliq`
- `Monitor`
- `smseagle`
- `Kook`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Generator`
- `Badge Duration`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateStatus`
- `emailTemplateHostnameOrURL`
- `-year`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `CurlDebugInfo`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CurlDebugInfoProxiesUnsupported`
- `Softvelum WebSocket signaling protocol`
- `Session Initiation Protocol`
- `WebSocket Application Messaging Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `WebSocket Transport for JMAP`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Collection Update`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Penguin Statistics Live Protocol v3`
- `year`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_is_ip`
- `GlobalpingDescription`
- `GlobalpingLocation`

</details>

### `el-GR` — Ελληνικά

- Missing keys: **807**
- Orphan keys pruned: **60**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `ZohoCliq`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `smseagle`
- `Monitor`
- `Kook`
- `squadcast`
- `atLeastOneMonitor`
- `SMSManager`
- `You can divide numbers with`
- `selectedMonitorCount`
- `cronSchedule`
- `-year`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `en_GB` — English

- Missing keys: **4**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `enm` — (no languageName)

- Missing keys: **1536**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `es-ES` — Español

- Missing keys: **228**
- Orphan keys pruned: **68**
- Type mismatches: **0**
- Placeholder mismatches: **4**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Also apply to existing monitors`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `steamApiKeyDescription`
- `Current User`
- `Last Updated`
- `Examples`
- `Created`
- `Monitor`
- `BodyInvalidFormat`
- `successMessageExplanation`
- `Date Created`
- `HeadersInvalidFormat`
- `successMessage`
- `Certificate Chain`
- `ZohoCliq`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `You can divide numbers with`
- `stackfield`
- `Sms template must contain parameters: `
- `atLeastOneMonitor`
- `endpoint`
- `PushByTechulus`
- `clicksendsms`
- `Kook`
- `checkPrice`
- `goAlert`
- `alerta`
- `smseagle`
- `gorush`
- `squadcast`
- `SMSManager`
- `Legacy Octopush-DM`
- `HomeAssistant`
- `matrix`
- `serwersms`
- `Unpin`
- `cronSchedule`
- `selectedMonitorCount`
- `Open Badge Generator`
- `Badge Generator`
- `webhookCustomBodyDesc`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `year`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `(none)`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `(none)`
- `mongodbCommandDescription` — en: `{documentation}` · locale: `(none)`
- `wayToGetClickSMSIRTemplateID` — en: `{here} {uptkumaalert}` · locale: `{uptkumaalert}`

### `et-EE` — eesti

- Missing keys: **1250**
- Orphan keys pruned: **29**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `alerta`
- `Certificate Chain`
- `Current User`
- `successMessage`
- `Created`
- `Last Updated`
- `Unpin`
- `steamApiKeyDescription`

</details>

### `eu` — Euskara

- Missing keys: **838**
- Orphan keys pruned: **52**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `ZohoCliq`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `Legacy Octopush-DM`
- `endpoint`
- `Monitor`
- `-year`
- `Examples`
- `cronSchedule`
- `emailTemplateStatus`
- `selectedMonitorCount`
- `Notification Service`
- `emailTemplateServiceName`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `fa` — فارسی

- Missing keys: **364**
- Orphan keys pruned: **37**
- Type mismatches: **0**
- Placeholder mismatches: **3**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Monitor`
- `successMessageExplanation`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `You can divide numbers with`
- `Certificate Chain`
- `steamApiKeyDescription`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `successMessage`
- `Created`
- `Last Updated`
- `Unpin`
- `Examples`
- `Notification Service`
- `atLeastOneMonitor`
- `Current User`
- `checkPrice`
- `Sms template must contain parameters: `
- `Legacy Octopush-DM`
- `Frontend Version`
- `Date Created`
- `endpoint`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Generator`
- `Badge Duration`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `documentationOf` — en: `{0}` · locale: `(none)`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `(none)`

### `fi` — Suomi

- Missing keys: **461**
- Orphan keys pruned: **76**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`
- `Resend Notification if Down X times consequently`
- `webhook`
- `BodyInvalidFormat`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `Certificate Chain`
- `Date Created`
- `telegram`
- `ZohoCliq`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `squadcast`
- `atLeastOneMonitor`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `Kook`
- `line`
- `mattermost`
- `checkPrice`
- `SMSManager`
- `goAlert`
- `Sms template must contain parameters: `
- `matrix`
- `gorush`
- `alerta`
- `serwersms`
- `smseagle`
- `stackfield`
- `Legacy Octopush-DM`
- `HomeAssistant`
- `HeadersInvalidFormat`
- `steamApiKeyDescription`
- `endpoint`
- `pushover`
- `pushbullet`
- `You can divide numbers with`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `Open Badge Generator`
- `Badge Generator`
- `cronSchedule`
- `selectedMonitorCount`
- `-year`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `CurlDebugInfo`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CurlDebugInfoProxiesUnsupported`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `fr-FR` — Français

- Missing keys: **2**
- Orphan keys pruned: **116**
- Type mismatches: **0**
- Placeholder mismatches: **4**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `atLeastOneMonitor`
- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `ZohoCliq`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `Kook`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `smseagle`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `Monitor`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Duration`
- `Badge Generator`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `CopyToClipboardError`
- `CurlDebugInfo`
- `Debug`
- `Copy`
- `CopyToClipboardSuccess`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CurlDebugInfoProxiesUnsupported`
- `Swindon Web Server Protocol`
- `Cobra Real Time Messaging Protocol`
- `WebSocket Transport for JMAP`
- `Collection Update`
- `Penguin Statistics Live Protocol v3`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Subprotocol`
- `year`
- `domain_expiry_unsupported_invalid_domain`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_public_suffix`
- `domain_expiry_unsupported_is_ip`
- `GlobalpingDescription`
- `GlobalpingLocation`

</details>

Placeholder mismatches:
- `Mention group` — en: `{group}` · locale: `{groupe}`
- `systemServiceCommandHint` — en: `{command}` · locale: `{commande}`
- `You can divide numbers with commas or semicolons` — en: `{comma} {semicolon}` · locale: `{virgule}`
- `aliyun-template-requirements-and-parameters` — en: `{parameters}` · locale: `(none)`

### `ga` — Gaeilge

- Missing keys: **2**
- Orphan keys pruned: **70**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`
- `BodyInvalidFormat`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `selectedMonitorCount`
- `Certificate Chain`
- `Date Created`
- `HeadersInvalidFormat`
- `steamApiKeyDescription`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `cronSchedule`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `atLeastOneMonitor`
- `endpoint`
- `checkPrice`
- `You can divide numbers with`
- `Sms template must contain parameters: `
- `Legacy Octopush-DM`
- `Open Badge Generator`
- `Badge Generator`
- `-year`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `WebSocket Transport for JMAP`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Collection Update`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Penguin Statistics Live Protocol v3`
- `year`
- `SMSManager`
- `promosms`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_is_ip`
- `GlobalpingLocation`

</details>

### `gl` — Galego

- Missing keys: **1515**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `he-IL` — אל תתרגם את languageName ישירות. זה השם של השפה שלך. לדוגמא: אנגלית לאנגלית, 简体中文 לסינית (פשוטה)

- Missing keys: **817**
- Orphan keys pruned: **59**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `atLeastOneMonitor`
- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `smseagle`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `Monitor`
- `ZohoCliq`
- `Kook`
- `cronSchedule`
- `selectedMonitorCount`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `he` — עברית

- Missing keys: **1533**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `hi` — हिंदी

- Missing keys: **1414**
- Orphan keys pruned: **7**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-hour`
- `-day`
- `hour`
- `-year`
- `Monitor`

</details>

Placeholder mismatches:
- `time ago` — en: `{0}` · locale: `(none)`

### `hr-HR` — Hrvatski

- Missing keys: **4**
- Orphan keys pruned: **74**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `Showing {from} to {to} of {count} records`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `PushByTechulus`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `successMessage`
- `successMessageExplanation`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `You can divide numbers with`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `Open Badge Generator`
- `cronSchedule`
- `atLeastOneMonitor`
- `Monitor`
- `Badge Generator`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `dns resolvers`
- `firewalls`
- `CurlDebugInfo`
- `docker networks`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CurlDebugInfoProxiesUnsupported`
- `GlobalpingLocation`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_is_ip`

</details>

Placeholder mismatches:
- `wayToGetClickSMSIRTemplateID` — en: `{here} {uptkumaalert}` · locale: `{ovdje} {uptkumaalert}`

### `hu` — Magyar

- Missing keys: **431**
- Orphan keys pruned: **60**
- Type mismatches: **0**
- Placeholder mismatches: **3**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `clicksendsms`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `PushByTechulus`
- `gorush`
- `alerta`
- `successMessageExplanation`
- `successMessage`
- `Certificate Chain`
- `Date Created`
- `atLeastOneMonitor`
- `endpoint`
- `Kook`
- `Resend Notification if Down X times consequently`
- `Monitor`
- `emailTemplateStatus`
- `selectedMonitorCount`
- `Examples`
- `Frontend Version`
- `cronSchedule`
- `You can divide numbers with`
- `Sms template must contain parameters: `
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Legacy Octopush-DM`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `-year`
- `Open Badge Generator`
- `Badge Generator`

</details>

Placeholder mismatches:
- `Mention group` — en: `{group}` · locale: `{csoport}`
- `time ago` — en: `{0}` · locale: `(none)`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `(none)`

### `id-ID` — Bahasa Indonesia (Indonesian)

- Missing keys: **162**
- Orphan keys pruned: **76**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `Monitor`
- `Badge Generator`
- `Badge Duration`
- `Open Badge Generator`
- `webhookCustomBodyDesc`
- `cronSchedule`
- `atLeastOneMonitor`
- `You can divide numbers with`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `selectedMonitorCount`
- `-year`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `CurlDebugInfo`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Subprotocol`
- `year`
- `SMSManager`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_public_suffix`
- `domain_expiry_unsupported_invalid_domain`
- `domain_expiry_unsupported_is_ip`

</details>

### `it-IT` — Italiano (Italian)

- Missing keys: **2**
- Orphan keys pruned: **89**
- Type mismatches: **0**
- Placeholder mismatches: **9**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `Monitor`
- `Resend Notification if Down X times consequently`
- `successMessage`
- `successMessageExplanation`
- `Certificate Chain`
- `selectedMonitorCount`
- `Date Created`
- `Examples`
- `Notification Service`
- `Frontend Version`
- `cronSchedule`
- `webhookCustomBodyDesc`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `atLeastOneMonitor`
- `endpoint`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `Sms template must contain parameters: `
- `You can divide numbers with`
- `-year`
- `Legacy Octopush-DM`
- `Open Badge Generator`
- `Badge Generator`
- `Binary Floor Control Protocol`
- `OPC UA Connection Protocol`
- `Constrained Application Protocol`
- `WebSocket Transport for JMAP`
- `Penguin Statistics Live Protocol v3`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Softvelum WebSocket signaling protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Collection Update`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Subprotocol`

</details>

Placeholder mismatches:
- `time ago` — en: `{0}` · locale: `(none)`
- `Could not clear events` — en: `{failed} {total}` · locale: `{falliti} {totali}`
- `rabbitmqHelpText` — en: `{rabitmq_documentation}` · locale: `(none)`
- `mongodbCommandDescription` — en: `{documentation}` · locale: `{documentazione}`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `{documentazione}`
- `wayToGetClickSMSIRTemplateID` — en: `{here} {uptkumaalert}` · locale: `{qui} {uptkumaalert}`
- `wsSubprotocolDescription` — en: `{documentation}` · locale: `{documentazione}`
- `logoutCurrentUser` — en: `{username}` · locale: `(none)`
- `createdAt` — en: `{date}` · locale: `{data}`

### `ja` — 日本語

- Missing keys: **421**
- Orphan keys pruned: **45**
- Type mismatches: **0**
- Placeholder mismatches: **2**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Also apply to existing monitors`
- `Monitor`
- `Resend Notification if Down X times consequently`
- `Date Created`
- `steamApiKeyDescription`
- `Current User`
- `Last Updated`
- `Unpin`
- `Created`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `successMessage`
- `successMessageExplanation`
- `Examples`
- `Certificate Chain`
- `endpoint`
- `Frontend Version`
- `cronSchedule`
- `Notification Service`
- `atLeastOneMonitor`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `selectedMonitorCount`
- `emailTemplateHostnameOrURL`
- `emailTemplateServiceName`
- `emailTemplateStatus`
- `-year`
- `CurlDebugInfoProxiesUnsupported`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `You can divide numbers with`
- `Open Badge Generator`
- `Badge Generator`
- `checkPrice`
- `Sms template must contain parameters: `
- `Legacy Octopush-DM`

</details>

Placeholder mismatches:
- `aboutChannelName` — en: `{0}` · locale: `(none)`
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `ka` — ქართული

- Missing keys: **930**
- Orphan keys pruned: **18**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `-hour`
- `hour`
- `-year`
- `-day`
- `Created`
- `endpoint`
- `Examples`
- `cronSchedule`
- `Frontend Version`
- `Current User`
- `Last Updated`
- `Legacy Octopush-DM`
- `Date Created`
- `Subprotocol`
- `Certificate Chain`
- `Notification Service`
- `selectedMonitorCount`

</details>

### `ko-KR` — 한국어

- Missing keys: **635**
- Orphan keys pruned: **62**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `matrix`
- `clicksendsms`
- `checkPrice`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `PushByTechulus`
- `successMessage`
- `successMessageExplanation`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `Legacy Octopush-DM`
- `endpoint`
- `You can divide numbers with`
- `smseagle`
- `SMSManager`
- `goAlert`
- `HomeAssistant`
- `ZohoCliq`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `squadcast`
- `Kook`
- `atLeastOneMonitor`
- `Monitor`
- `cronSchedule`
- `-year`
- `selectedMonitorCount`
- `Open Badge Generator`
- `Badge Generator`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`

### `lt` — Lietuvių

- Missing keys: **14**
- Orphan keys pruned: **61**
- Type mismatches: **0**
- Placeholder mismatches: **2**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Monitor`
- `Current User`
- `Created`
- `Last Updated`
- `selectedMonitorCount`
- `-year`
- `HeadersInvalidFormat`
- `Date Created`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `cronSchedule`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `atLeastOneMonitor`
- `endpoint`
- `checkPrice`
- `You can divide numbers with`
- `Sms template must contain parameters: `
- `Legacy Octopush-DM`
- `Open Badge Generator`
- `Badge Generator`
- `Certificate Chain`
- `Examples`
- `WebSocket Transport for JMAP`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Collection Update`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Penguin Statistics Live Protocol v3`
- `year`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `wsSubprotocolDescription` — en: `{documentation}` · locale: `{dokumentacijoje}`

### `lv` — Latviešu

- Missing keys: **1437**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `lzh` — (no languageName)

- Missing keys: **1536**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `mk` — Македонски

- Missing keys: **1452**
- Orphan keys pruned: **6**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`

</details>

### `ml` — മലയാളം

- Missing keys: **1489**
- Orphan keys pruned: **3**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `hour`
- `-hour`

</details>

### `ms` — Bahasa inggeris

- Missing keys: **1455**
- Orphan keys pruned: **7**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `hour`
- `Monitor`
- `day`
- `-day`
- `-year`
- `-hour`

</details>

### `my` — အင်္ဂလိပ်ဘာသာ

- Missing keys: **1449**
- Orphan keys pruned: **6**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`

</details>

Placeholder mismatches:
- `disableauth.message1` — en: `{disableAuth}` · locale: `(none)`

### `nb-NO` — Norsk

- Missing keys: **43**
- Orphan keys pruned: **46**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `matrix`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `selectedMonitorCount`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Certificate Chain`
- `Date Created`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `Monitor`
- `-year`
- `Frontend Version`
- `cronSchedule`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_is_ip`
- `GlobalpingDescription`
- `GlobalpingLocation`

</details>

Placeholder mismatches:
- `needPushEvery` — en: `{0}` · locale: `(none)`

### `ne` — (no languageName)

- Missing keys: **1536**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `nl-NL` — Nederlands

- Missing keys: **65**
- Orphan keys pruned: **104**
- Type mismatches: **0**
- Placeholder mismatches: **5**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Also apply to existing monitors`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `PushByTechulus`
- `clicksendsms`
- `checkPrice`
- `matrix`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `endpoint`
- `Examples`
- `Frontend Version`
- `squadcast`
- `Kook`
- `goAlert`
- `HomeAssistant`
- `Resend Notification if Down X times consequently`
- `Monitor`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `atLeastOneMonitor`
- `smseagle`
- `ZohoCliq`
- `SMSManager`
- `You can divide numbers with`
- `Legacy Octopush-DM`
- `webhookCustomBodyDesc`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Generator`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `selectedMonitorCount`
- `-year`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Softvelum WebSocket signaling protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `Penguin Statistics Live Protocol v3`
- `Subprotocol`
- `WebSocket Transport for JMAP`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Collection Update`
- `GlobalpingDescription`
- `GlobalpingLocation`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_is_ip`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `Either enter the hostname of the server you want to connect to or localhost if you intend to use a locally configured mail transfer agent` — en: `{local_mta} {localhost}` · locale: `{localhost}`
- `rabbitmqHelpText` — en: `{rabitmq_documentation}` · locale: `{rabitmq_documentatie}`
- `mqttHostnameTip` — en: `{hostnameFormat}` · locale: `{hostnaamFormat}`
- `issueWithGoogleChatOnAndroidHelptext` — en: `{issuetackerURL}` · locale: `{issuetrackerURL}`

### `pa` — پنجابی

- Missing keys: **1531**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `pa_PK` — ਅੰਗਰੇਜ਼ੀ

- Missing keys: **1526**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `pl` — Polski

- Missing keys: **108**
- Orphan keys pruned: **85**
- Type mismatches: **0**
- Placeholder mismatches: **2**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `matrix`
- `checkPrice`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `clicksendsms`
- `serwersms`
- `smseagle`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `atLeastOneMonitor`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `Kook`
- `Monitor`
- `ZohoCliq`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Generator`
- `Badge Duration`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `CopyToClipboardError`
- `CurlDebugInfo`
- `Debug`
- `Copy`
- `CopyToClipboardSuccess`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CurlDebugInfoProxiesUnsupported`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `WebSocket Application Messaging Protocol`
- `Reverse Web Process Control`
- `GlobalpingLocation`
- `domain_expiry_unsupported_is_ip`
- `GlobalpingDescription`
- `domain_expiry_public_suffix_too_short`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `{dokumentacji}`

### `pt-BR` — Português (Brasileiro)

- Missing keys: **2**
- Orphan keys pruned: **83**
- Type mismatches: **0**
- Placeholder mismatches: **9**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Monitor`
- `BodyInvalidFormat`
- `Current User`
- `successMessage`
- `Created`
- `Last Updated`
- `HeadersInvalidFormat`
- `steamApiKeyDescription`
- `successMessageExplanation`
- `Certificate Chain`
- `Notification Service`
- `cronSchedule`
- `Unpin`
- `atLeastOneMonitor`
- `Date Created`
- `Examples`
- `Frontend Version`
- `endpoint`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `selectedMonitorCount`
- `checkPrice`
- `You can divide numbers with`
- `Legacy Octopush-DM`
- `Sms template must contain parameters: `
- `webhookCustomBodyDesc`
- `Open Badge Generator`
- `Badge Generator`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `firewalls`
- `docker networks`
- `Web Process Control Protocol`
- `Collection Update`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `WebSocket Transport for JMAP`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Penguin Statistics Live Protocol v3`
- `Subprotocol`
- `year`
- `SMSManager`
- `promosms`
- `domain_expiry_unsupported_invalid_domain`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_public_suffix`
- `domain_expiry_unsupported_is_ip`
- `GlobalpingDescription`
- `GlobalpingLocation`

</details>

Placeholder mismatches:
- `emojiCheatSheet` — en: `{0}` · locale: `(none)`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `(none)`
- `mongodbCommandDescription` — en: `{documentation}` · locale: `(none)`
- `Mention group` — en: `{group}` · locale: `{grupo}`
- `time ago` — en: `{0}` · locale: `(none)`
- `wayToGetClickSMSIRTemplateID` — en: `{here} {uptkumaalert}` · locale: `{aqui} {uptkumaalert}`
- `systemServiceCommandHint` — en: `{command}` · locale: `{comando}`
- `Badge Link Generator Helptext` — en: `{documentation}` · locale: `(none)`
- `Screenshot Delay` — en: `{milliseconds}` · locale: `{miliseconds}`

### `pt-PT` — Português (Portugal)

- Missing keys: **1062**
- Orphan keys pruned: **27**
- Type mismatches: **0**
- Placeholder mismatches: **2**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `Created`
- `Last Updated`
- `Unpin`
- `Date Created`
- `ZohoCliq`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `squadcast`
- `Resend Notification if Down X times consequently`
- `webhook`
- `successMessageExplanation`
- `telegram`
- `Monitor`
- `Certificate Chain`
- `-year`

</details>

Placeholder mismatches:
- `liquidIntroduction` — en: `{0}` · locale: `(none)`
- `statusPageRefreshIn` — en: `{0}` · locale: `(none)`

### `pt` — Português

- Missing keys: **1305**
- Orphan keys pruned: **8**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `Monitor`
- `hour`
- `-hour`
- `-day`
- `-year`
- `Current User`

</details>

### `ro` — Română

- Missing keys: **503**
- Orphan keys pruned: **57**
- Type mismatches: **0**
- Placeholder mismatches: **4**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `webhook`
- `BodyInvalidFormat`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Last Updated`
- `Unpin`
- `Certificate Chain`
- `Date Created`
- `telegram`
- `ZohoCliq`
- `Examples`
- `Frontend Version`
- `squadcast`
- `atLeastOneMonitor`
- `endpoint`
- `discord`
- `teams`
- `signal`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `Kook`
- `line`
- `mattermost`
- `-hour`
- `Resend Notification if Down X times consequently`
- `HeadersInvalidFormat`
- `steamApiKeyDescription`
- `Created`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `gotify`
- `clicksendsms`
- `checkPrice`
- `Sms template must contain parameters: `
- `You can divide numbers with`
- `cronSchedule`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `selectedMonitorCount`
- `Legacy Octopush-DM`
- `Open Badge Generator`
- `Badge Generator`
- `-year`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `(none)`
- `Mention group` — en: `{group}` · locale: `{grup}`
- `mongodbCommandDescription` — en: `{documentation}` · locale: `(none)`

### `ru-RU` — Русский

- Missing keys: **3**
- Orphan keys pruned: **121**
- Type mismatches: **0**
- Placeholder mismatches: **5**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Also apply to existing monitors`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Certificate Chain`
- `Created`
- `Unpin`
- `3h`
- `6h`
- `24h`
- `1w`
- `Current User`
- `Accept characters: a-z 0-9 -`
- `Start or end with a-z 0-9 only`
- `No consecutive dashes --`
- `PushByTechulus`
- `clicksendsms`
- `Last Updated`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `atLeastOneMonitor`
- `Monitor`
- `Resend Notification if Down X times consequently`
- `successMessage`
- `successMessageExplanation`
- `ZohoCliq`
- `smseagle`
- `Kook`
- `cronSchedule`
- `Badge Generator`
- `Badge Duration`
- `Open Badge Generator`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `CurlDebugInfoOAuth2CCUnsupported`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoProxiesUnsupported`
- `-year`
- `Binary Floor Control Protocol`
- `Swindon Web Server Protocol`
- `Softvelum WebSocket signaling protocol`
- `BACnet Secure Connect Hub Connection`
- `Done.best IoT Protocol`
- `Binary IRC Protocol`
- `WebSocket Application Messaging Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Extensible Messaging and Presence Protocol`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Direct Connection`
- `WebSocket Transport for JMAP`
- `ITU-T T.140 Real-Time Text`
- `Collection Update`
- `Text IRC Protocol`
- `Penguin Statistics Live Protocol v3`
- `year`
- `GlobalpingDescription`
- `domain_expiry_unsupported_is_ip`
- `domain_expiry_public_suffix_too_short`
- `GlobalpingLocation`

</details>

Placeholder mismatches:
- `callMeBotGet` — en: `{0} {1} {2} {3}` · locale: `{0} {1} {2} {3} {endpoint}`
- `cellsyntOriginator` — en: `(none)` · locale: `{originatortype}`
- `mongodbCommandDescription` — en: `{documentation}` · locale: `(none)`
- `issueWithGoogleChatOnAndroidHelptext` — en: `{issuetackerURL}` · locale: `{issuetakerURL}`
- `wayToGetClickSMSIRTemplateID` — en: `{here} {uptkumaalert}` · locale: `{uptkumaalert}`

### `sk` — Slovenčina

- Missing keys: **2**
- Orphan keys pruned: **75**
- Type mismatches: **0**
- Placeholder mismatches: **2**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `hour`
- `Monitor`
- `-day`
- `-hour`
- `webhookCustomBodyDesc`
- `Certificate Chain`
- `Created`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Last Updated`
- `selectedMonitorCount`
- `shrinkDatabaseDescription`
- `HeadersInvalidFormat`
- `Date Created`
- `Examples`
- `Frontend Version`
- `cronSchedule`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `-year`
- `You can divide numbers with`
- `checkPrice`
- `Sms template must contain parameters: `
- `atLeastOneMonitor`
- `endpoint`
- `Badge Generator`
- `Open Badge Generator`
- `Legacy Octopush-DM`
- `WebSocket Application Messaging Protocol`
- `Extensible Messaging and Presence Protocol`
- `Session Initiation Protocol`
- `Network API for Notification Channel`
- `Web Process Control Protocol`
- `Advanced Message Queuing Protocol`
- `jsflow`
- `Reverse Web Process Control`
- `Smart Home IP`
- `Miele Cloud Connect Protocol`
- `Push Channel Protocol`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Cobra Real Time Messaging Protocol`
- `Declarative Resource Protocol`
- `BACnet Secure Connect Hub Connection`
- `BACnet Secure Connect Direct Connection`
- `WebSocket Transport for JMAP`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Collection Update`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Penguin Statistics Live Protocol v3`
- `Subprotocol`
- `SMSManager`
- `promosms`
- `year`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_public_suffix`
- `domain_expiry_unsupported_is_ip`
- `domain_expiry_unsupported_invalid_domain`
- `GlobalpingDescription`
- `GlobalpingLocation`

</details>

Placeholder mismatches:
- `Mention group` — en: `{group}` · locale: `{skupinu}`
- `wayToGetClickSMSIRTemplateID` — en: `{here} {uptkumaalert}` · locale: `{tu} {uptkumaalert}`

### `sl-SI` — Slovenščina

- Missing keys: **945**
- Orphan keys pruned: **39**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `successMessage`
- `selectedMonitorCount`
- `cronSchedule`
- `Monitor`
- `Certificate Chain`
- `Date Created`
- `Examples`

</details>

### `sq` — Shqip

- Missing keys: **1292**
- Orphan keys pruned: **9**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`
- `Current User`
- `Created`
- `Last Updated`

</details>

Placeholder mismatches:
- `pushOptionalParams` — en: `{0}` · locale: `(none)`

### `sr-latn` — Srpski

- Missing keys: **1428**
- Orphan keys pruned: **5**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`

</details>

### `sr` — Српски

- Missing keys: **1429**
- Orphan keys pruned: **5**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`

</details>

### `sv-SE` — Svenska

- Missing keys: **325**
- Orphan keys pruned: **74**
- Type mismatches: **0**
- Placeholder mismatches: **4**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Monitor`
- `steamApiKeyDescription`
- `webhookCustomBodyDesc`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `Current User`
- `successMessageExplanation`
- `successMessage`
- `Created`
- `Last Updated`
- `selectedMonitorCount`
- `Certificate Chain`
- `Unpin`
- `Date Created`
- `emailTemplateStatus`
- `Examples`
- `Notification Service`
- `cronSchedule`
- `Sms template must contain parameters: `
- `Frontend Version`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `emailTemplateHostnameOrURL`
- `emailTemplateServiceName`
- `atLeastOneMonitor`
- `endpoint`
- `checkPrice`
- `You can divide numbers with`
- `Legacy Octopush-DM`
- `Open Badge Generator`
- `Badge Generator`
- `CopyToClipboardError`
- `-year`
- `Debug`
- `Copy`
- `CopyToClipboardSuccess`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `Session Initiation Protocol`
- `jsflow`
- `Push Channel Protocol`
- `Declarative Resource Protocol`
- `Miele Cloud Connect Protocol`
- `Softvelum Low Delay Protocol`
- `OPC UA Connection Protocol`
- `OPC UA JSON Encoding`
- `Constrained Application Protocol`
- `Softvelum WebSocket signaling protocol`
- `Web Process Control Protocol`
- `Smart Home IP`
- `Cobra Real Time Messaging Protocol`
- `BACnet Secure Connect Hub Connection`
- `WebSocket Application Messaging Protocol`
- `Advanced Message Queuing Protocol`
- `Reverse Web Process Control`
- `Swindon Web Server Protocol`
- `Broadband Forum User Services Platform`
- `BACnet Secure Connect Direct Connection`
- `ITU-T T.140 Real-Time Text`
- `Done.best IoT Protocol`
- `Text IRC Protocol`
- `Binary IRC Protocol`
- `Collection Update`
- `WebSocket Transport for JMAP`
- `Network API for Notification Channel`
- `Message Session Relay Protocol`
- `Binary Floor Control Protocol`
- `Extensible Messaging and Presence Protocol`
- `Penguin Statistics Live Protocol v3`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `(none)`
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `{dokumentationen}`
- `wayToGetClickSMSIRTemplateID` — en: `{here} {uptkumaalert}` · locale: `{uptkumaalert}`
- `wsSubprotocolDescription` — en: `{documentation}` · locale: `{dokumentationen}`

### `te` — తెలుగు

- Missing keys: **1242**
- Orphan keys pruned: **18**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`
- `BodyInvalidFormat`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `selectedMonitorCount`
- `Certificate Chain`
- `webhookCustomBodyDesc`
- `HeadersInvalidFormat`
- `steamApiKeyDescription`

</details>

Placeholder mismatches:
- `defaultNotificationName` — en: `{notification} {number}` · locale: `(none)`

### `th-TH` — ไทย

- Missing keys: **553**
- Orphan keys pruned: **58**
- Type mismatches: **0**
- Placeholder mismatches: **4**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `Legacy Octopush-DM`
- `endpoint`
- `HomeAssistant`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `Monitor`
- `ZohoCliq`
- `squadcast`
- `cronSchedule`
- `-year`
- `selectedMonitorCount`
- `You can divide numbers with`
- `atLeastOneMonitor`
- `Open Badge Generator`
- `Badge Generator`

</details>

Placeholder mismatches:
- `days` — en: `{n}` · locale: `(none)`
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `cloneOf` — en: `{0}` · locale: `(none)`
- `wsSubprotocolDescription` — en: `{documentation}` · locale: `(none)`

### `tr-TR` — Türkçe

- Missing keys: **323**
- Orphan keys pruned: **77**
- Type mismatches: **0**
- Placeholder mismatches: **2**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `PushByTechulus`
- `pushbullet`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `atLeastOneMonitor`
- `ZohoCliq`
- `Kook`
- `smseagle`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `Monitor`
- `rocket.chat`
- `slack`
- `pushover`
- `clicksendsms`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `line`
- `mattermost`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Generator`
- `Badge Duration`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CurlDebugInfoProxiesUnsupported`
- `CurlDebugInfo`

</details>

Placeholder mismatches:
- `wayToGetHeiiOnCallDetails` — en: `{documentation}` · locale: `(none)`
- `mongodbCommandDescription` — en: `{documentation}` · locale: `(none)`

### `ug` — (no languageName)

- Missing keys: **1536**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `uk-UA` — Українська

- Missing keys: **418**
- Orphan keys pruned: **84**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Also apply to existing monitors`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `Номер`
- `checkPrice`
- `matrix`
- `Feishu WebHookURL`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Certificate Chain`
- `Created`
- `Unpin`
- `3h`
- `6h`
- `24h`
- `1w`
- `Current User`
- `Acz characters: a-z 0-9 -`
- `Start or end with a-z 0-9 only`
- `No consecutive dashes --`
- `PushByTechulus`
- `clicksendsms`
- `Last Updated`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Sms template must contain parameters: `
- `Date Created`
- `Legacy Octopush-DM`
- `endpoint`
- `HomeAssistant`
- `Resend Notification if Down X times consequently`
- `Monitor`
- `smseagle`
- `successMessage`
- `You can divide numbers with`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `successMessageExplanation`
- `Frontend Version`
- `atLeastOneMonitor`
- `Examples`
- `cronSchedule`
- `Open Badge Generator`
- `Badge Generator`
- `Badge Duration`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `Debug`
- `Copy`
- `CopyToClipboardError`
- `CopyToClipboardSuccess`
- `firewalls`
- `dns resolvers`
- `docker networks`
- `CurlDebugInfoProxiesUnsupported`
- `CurlDebugInfo`
- `CurlDebugInfoOAuth2CCUnsupported`
- `year`

</details>

### `ur` — انگریزی

- Missing keys: **1000**
- Orphan keys pruned: **31**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `goAlert`
- `-hour`
- `Sms template must contain parameters: `
- `Resend Notification if Down X times consequently`
- `webhook`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `steamApiKeyDescription`
- `Examples`
- `Certificate Chain`
- `Date Created`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `Notification Service`
- `cronSchedule`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`

</details>

### `uz` — O'zbek tili

- Missing keys: **1447**
- Orphan keys pruned: **6**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `Monitor`
- `day`
- `-day`
- `hour`
- `-hour`

</details>

### `vi-VN` — Tiếng Việt

- Missing keys: **949**
- Orphan keys pruned: **45**
- Type mismatches: **0**
- Placeholder mismatches: **3**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `Monitor`
- `-year`
- `selectedMonitorCount`
- `GlobalpingLocation`

</details>

Placeholder mismatches:
- `wayToGetTelegramToken` — en: `{0}` · locale: `(none)`
- `webhookBodyPresetOption` — en: `{0}` · locale: `(none)`
- `wayToGetClickSMSIRTemplateID` — en: `{here} {uptkumaalert}` · locale: `{uptkumaalert}`

### `vls` — West-Vloams

- Missing keys: **87**
- Orphan keys pruned: **6**
- Type mismatches: **0**
- Placeholder mismatches: **5**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `GlobalpingDescription`
- `GlobalpingLocation`
- `domain_expiry_unsupported_is_ip`
- `domain_expiry_public_suffix_too_short`

</details>

Placeholder mismatches:
- `Either enter the hostname of the server you want to connect to or localhost if you intend to use a locally configured mail transfer agent` — en: `{local_mta} {localhost}` · locale: `{localhost}`
- `mqttHostnameTip` — en: `{hostnameFormat}` · locale: `{hostnaamFormat}`
- `issueWithGoogleChatOnAndroidHelptext` — en: `{issuetackerURL}` · locale: `{issuetrackerURL}`
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `rabbitmqHelpText` — en: `{rabitmq_documentation}` · locale: `{rabitmq_documentatie}`

### `xh` — (no languageName)

- Missing keys: **1531**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

### `yue` — 繁體中文 (廣東話 / 粵語)

- Missing keys: **1434**
- Orphan keys pruned: **6**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Monitor`

</details>

Placeholder mismatches:
- `wayToGetFlashDutyKey` — en: `(none)` · locale: `{0}`

### `zh-CN` — 简体中文

- Missing keys: **2**
- Orphan keys pruned: **118**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `atLeastOneMonitor`
- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `ZohoCliq`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `Kook`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `Feishu`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `smseagle`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `WeCom`
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `Monitor`
- `cronSchedule`
- `Badge Duration`
- `Badge Generator`
- `Open Badge Generator`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `emailTemplateStatus`
- `emailTemplateHostnameOrURL`
- `emailTemplateServiceName`
- `-year`
- `Copy`
- `Debug`
- `CopyToClipboardSuccess`
- `CopyToClipboardError`
- `CurlDebugInfoProxiesUnsupported`
- `docker networks`
- `dns resolvers`
- `firewalls`
- `CurlDebugInfoOAuth2CCUnsupported`
- `CurlDebugInfo`
- `Swindon Web Server Protocol`
- `WebSocket Transport for JMAP`
- `Miele Cloud Connect Protocol`
- `Extensible Messaging and Presence Protocol`
- `Network API for Notification Channel`
- `Reverse Web Process Control`
- `jsflow`
- `Advanced Message Queuing Protocol`
- `Web Process Control Protocol`
- `Session Initiation Protocol`
- `WebSocket Application Messaging Protocol`
- `Smart Home IP`
- `OPC UA JSON Encoding`
- `OPC UA Connection Protocol`
- `Softvelum Low Delay Protocol`
- `Binary Floor Control Protocol`
- `Message Session Relay Protocol`
- `Push Channel Protocol`
- `Penguin Statistics Live Protocol v3`
- `Binary IRC Protocol`
- `Text IRC Protocol`
- `Collection Update`
- `BACnet Secure Connect Direct Connection`
- `BACnet Secure Connect Hub Connection`
- `Cobra Real Time Messaging Protocol`
- `Softvelum WebSocket signaling protocol`
- `Constrained Application Protocol`
- `Broadband Forum User Services Platform`
- `Done.best IoT Protocol`
- `ITU-T T.140 Real-Time Text`
- `Declarative Resource Protocol`
- `Subprotocol`
- `year`
- `domain_expiry_public_suffix_too_short`
- `domain_expiry_unsupported_invalid_domain`
- `domain_expiry_unsupported_is_ip`
- `domain_expiry_unsupported_public_suffix`
- `GlobalpingDescription`
- `GlobalpingLocation`

</details>

### `zh-HK` — 繁體中文 (香港)

- Missing keys: **514**
- Orphan keys pruned: **65**
- Type mismatches: **0**
- Placeholder mismatches: **2**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `Also apply to existing monitors`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `octopush`
- `promosms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `PushByTechulus`
- `clicksendsms`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `Showing {from} to {to} of {count} records`
- `steamApiKeyDescription`
- `Current User`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `stackfield`
- `gorush`
- `alerta`
- `Date Created`
- `Monitor`
- `successMessage`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `successMessageExplanation`
- `Certificate Chain`
- `ZohoCliq`
- `Examples`
- `Notification Service`
- `squadcast`
- `Frontend Version`
- `HomeAssistant`
- `Kook`
- `atLeastOneMonitor`
- `endpoint`
- `Legacy Octopush-DM`
- `smseagle`
- `cronSchedule`
- `selectedMonitorCount`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`
- `You can divide numbers with`
- `Sms template must contain parameters: `
- `Open Badge Generator`
- `Badge Generator`

</details>

Placeholder mismatches:
- `wayToGetClickSendSMSToken` — en: `{here}` · locale: `{0}`
- `wayToGetFlashDutyKey` — en: `(none)` · locale: `{0}`

### `zh-TW` — 繁體中文 (臺灣)

- Missing keys: **336**
- Orphan keys pruned: **64**
- Type mismatches: **0**
- Placeholder mismatches: **1**
- In-file duplicates: **0**

<details><summary>Orphan keys removed</summary>

- `atLeastOneMonitor`
- `Version`
- `day`
- `-day`
- `hour`
- `-hour`
- `telegram`
- `webhook`
- `discord`
- `teams`
- `signal`
- `gotify`
- `slack`
- `rocket.chat`
- `pushover`
- `pushy`
- `PushByTechulus`
- `octopush`
- `promosms`
- `clicksendsms`
- `lunasea`
- `pushbullet`
- `line`
- `mattermost`
- `checkPrice`
- `matrix`
- `HeadersInvalidFormat`
- `BodyInvalidFormat`
- `steamApiKeyDescription`
- `Current User`
- `successMessage`
- `successMessageExplanation`
- `Created`
- `Last Updated`
- `Unpin`
- `serwersms`
- `smseagle`
- `stackfield`
- `gorush`
- `alerta`
- `Certificate Chain`
- `Sms template must contain parameters: `
- `Date Created`
- `HomeAssistant`
- `Legacy Octopush-DM`
- `endpoint`
- `Examples`
- `Notification Service`
- `A list of Notification Services can be found in Home Assistant under "Developer Tools > Services" search for "notification" to find your device/phone name.`
- `Frontend Version`
- `goAlert`
- `squadcast`
- `SMSManager`
- `You can divide numbers with`
- `Monitor`
- `cronSchedule`
- `webhookCustomBodyDesc`
- `selectedMonitorCount`
- `Open Badge Generator`
- `Badge Generator`
- `emailTemplateServiceName`
- `emailTemplateHostnameOrURL`
- `emailTemplateStatus`
- `-year`

</details>

Placeholder mismatches:
- `issueWithGoogleChatOnAndroidHelptext` — en: `{issuetackerURL}` · locale: `{issustackerURL}`

### `zu` — IsiNgisi

- Missing keys: **1525**
- Orphan keys pruned: **0**
- Type mismatches: **0**
- Placeholder mismatches: **0**
- In-file duplicates: **0**
