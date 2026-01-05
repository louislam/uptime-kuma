import json
import os
import re


def find_missing_translations():
    # Load the English translation file
    with open("src/lang/en.json", "r", encoding="utf-8") as f:
        en_translations = json.load(f)

    # Regex to find i18n keys in Vue files
    translation_regex = re.compile(
        # Matches $t('key'), $t("key"), $t('key', [ ... ])
        r"""\$t\((['"])(?P<key1>.*?)\1\s*[,)]"""
        + "|"
        +
        # Matches i18n-t keypath="key"
        r"""i18n-t\s+keypath="(?P<key2>[^"]+)" """,
        re.VERBOSE,
    )

    missing_keys = []

    # Walk through the src directory
    for root, _, files in os.walk("src"):
        for file in files:
            if file.endswith((".vue", ".js")):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        for line_num, line in enumerate(lines, 1):
                            for match in translation_regex.finditer(line):
                                key = (
                                    match.group("key1")
                                    or match.group("key2")
                                    or match.group("key3")
                                )
                                if key and key not in en_translations:
                                    # Find start and end of the key itself
                                    for group_name in ["key1", "key2", "key3"]:
                                        if match.group(group_name):
                                            start, end = match.span(group_name)
                                            break
                                    missing_keys.append(
                                        (
                                            file_path,
                                            line_num,
                                            key,
                                            line.rstrip(),
                                            start,
                                            end,
                                        )
                                    )

                except UnicodeDecodeError:
                    print(f"Skipping file due to UnicodeDecodeError: {file_path}")

    # Print the report
    if not missing_keys:
        print("No missing translation keys found.")
    else:
        for file_path, line_num, key, line_content, start, end in missing_keys:
            print(f"\nerror: Missing translation key: '{key}'")
            print(f"   --> {file_path}:{line_num}:{start}")
            print("     |")
            print(f"{line_num:<5}| {line_content}")
            arrow = " " * (start - 1) + "^" * (end - start + 2)
            print(f"     | {arrow} unrecognized translation key")
            print("     |")
            print(
                f"     = note: please register the translation key '{key}' in en.json so that our awesome team of translators can translate them"
            )
            print(
                "     = tip: if you want to contribute translations, please visit our https://weblate.kuma.pet"
            )
            print("")

        print("===============================")
        file_count = len(set([item[0] for item in missing_keys]))
        print(
            f"Found a total of {len(missing_keys)} missing keys in {file_count} files."
        )


if __name__ == "__main__":
    find_missing_translations()
