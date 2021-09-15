# How to translate

1. Fork this repo.
2. Create a language file (e.g. `zh-TW.js`). The filename must be ISO language code: http://www.lingoes.net/en/translator/langcode.htm
3. `npm run update-language-files`
4. Your language file should be filled in. You can translate now.
5. Translate `src/pages/Settings.vue` (search for a `Confirm` component with `rel="confirmDisableAuth"`).
6. Import your language file in `src/i18n.js` and add it to `languageList` constant.
7. Make a [pull request](https://github.com/louislam/uptime-kuma/pulls) when you have done.

One of good examples:
https://github.com/louislam/uptime-kuma/pull/316/files

If you do not have programming skills, let me know in [Issues section](https://github.com/louislam/uptime-kuma/issues). I will assist you. 😏
