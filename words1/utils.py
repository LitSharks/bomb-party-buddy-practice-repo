import os
import argparse
import unicodedata
import re

def is_correct(word):
    pattern = r'^[a-z]+(-[a-z]+)*$'
    return bool(re.match(pattern, word))

def clean_txt_files():
    files = [f for f in os.listdir("./") if f.endswith(".txt")]

    for f in files:
        print(f)
        with open(f, "r", encoding="utf-8") as file:
            words = file.read().split("\n")
        words = [unicodedata.normalize("NFKD", w).encode("ascii", "ignore").decode("ascii") for w in words if " " not in w and len(w) > 0]
        words = list(set(words)) # remove duplicate
        words = [w for w in words if is_correct(w)] # remove non-letters and proper nouns
        words.sort() # sort

        with open(f, "w", encoding="utf-8", newline="\n") as file:
            file.write("\n".join(words))

def combine_words(source_file, language):
    lang_file = f"{language}.txt"
    if not os.path.exists(lang_file):
        print(f"Language file '{lang_file}' does not exist.")
        return

    # Read words from source file
    with open(source_file, "r", encoding="utf-8") as sf:
        source_words = sf.read().split("\n")
        source_words = [unicodedata.normalize("NFKD", w).encode("ascii", "ignore").decode("ascii") for w in source_words if " " not in w and is_correct(w)]

    # Read words from language file
    with open(lang_file, "r") as lf:
        lang_words = lf.read().split("\n")
        lang_words = [w for w in lang_words if " " not in w and is_correct(w)]

    # Combine, deduplicate, sort
    combined = list(set(lang_words + source_words))
    combined.sort()

    # Write back to language file
    with open(lang_file, "w", newline="\n") as lf:
        lf.write("\n".join(combined))
    print(f"Combined words from '{source_file}' into '{lang_file}'.")

def remove_words(source_file, language, separator):
    lang_file = f"{language}.txt"
    if not os.path.exists(lang_file):
        print(f"Language file '{lang_file}' does not exist.")
        return
    
    # Read words from source file
    with open(source_file, "r", encoding="utf-8") as sf:
        source_words = sf.read().split(separator)
        source_words = [unicodedata.normalize("NFKD", w).encode("ascii", "ignore").decode("ascii") for w in source_words]

     # Read words from language file
    with open(lang_file, "r") as lf:
        lang_words = lf.read().split("\n")

    filtered = [w for w in lang_words if w not in source_words]

    
    # Write back to language file
    with open(lang_file, "w", newline="\n") as lf:
        lf.write("\n".join(filtered))
    print(f"Removed words from '{lang_file}' which are present in '{source_file}'.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Utilities for word files.")
    parser.add_argument("--clean", action="store_true", help="Clean all .txt files in the current directory.")
    parser.add_argument("--combine", nargs=2, metavar=("FILENAME", "LANGUAGE"), help="Combine words from FILENAME into LANGUAGE.txt if it exists.")
    parser.add_argument("--remove", nargs=2, metavar=("FILENAME", "LANGUAGE"), help="Remove words from LANGUAGE.txt which are present in FILENAME.")
    parser.add_argument("--separator", "-s", default="\n", help="Separator used to parse FILENAME.")
    args = parser.parse_args()

    if args.clean:
        clean_txt_files()
    elif args.combine:
        combine_words(args.combine[0], args.combine[1])
    elif args.remove:
        remove_words(args.remove[0], args.remove[1], args.separator)
    else:
        parser.print_usage()