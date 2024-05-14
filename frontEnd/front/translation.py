import json
import sys
import os

def add_translation(en_key, en_translation, fr_translation, en_file='src/assets/i18n/EN.json', fr_file='src/assets/i18n/FR.json'):
    # Load existing English translations
    if os.path.exists(en_file):
        with open(en_file, 'r', encoding='utf-8') as file:
            en_data = json.load(file)
    else:
        en_data = {}

    # Load existing French translations
    if os.path.exists(fr_file):
        with open(fr_file, 'r', encoding='utf-8') as file:
            fr_data = json.load(file)
    else:
        fr_data = {}

    # Add new translations
    en_data[en_key] = en_translation
    fr_data[en_key] = fr_translation

    # Save updated English translations
    with open(en_file, 'w', encoding='utf-8') as file:
        json.dump(en_data, file, ensure_ascii=False, indent=4)

    # Save updated French translations
    with open(fr_file, 'w', encoding='utf-8') as file:
        json.dump(fr_data, file, ensure_ascii=False, indent=4)

    print(f"Translation for '{en_key}' added successfully.")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: python add_translation.py <EN_KEY> <EN_TRANSLATION> <FR_TRANSLATION>")
        sys.exit(1)

    en_key = sys.argv[1]
    en_translation = sys.argv[2]
    fr_translation = sys.argv[3]

    add_translation(en_key, en_translation, fr_translation)
