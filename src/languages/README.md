# How to translate

1. Fork this repo.
2. Create a language file (e.g. `zh-TW.js`). The filename must be ISO language code: http://www.lingoes.net/en/translator/langcode.htm
3. Run `npm run update-language-files`. You can also use this command to check if there are new strings to translate for your language.
4. Your language file should be filled in. You can translate now.
5. Translate `src/components/settings/Security.vue` (search for a `Confirm` component with `rel="confirmDisableAuth"`).
6. Add it into `languageList` constant.
7. Make a [pull request](https://github.com/louislam/uptime-kuma/pulls) when you have done.

If you do not have programming skills, let me know in [the issues section](https://github.com/louislam/uptime-kuma/issues). I will assist you. 😏
