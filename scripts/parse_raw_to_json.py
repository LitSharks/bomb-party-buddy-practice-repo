import json
from pathlib import Path

def parse_raw(text: str):
    chapters = []
    current_chapter = None
    current_lesson = None
    for line in text.splitlines():
        stripped = line.rstrip()
        if not stripped:
            continue
        if stripped.startswith("Chapter:"):
            if current_chapter:
                if current_lesson:
                    current_chapter["lessons"].append(current_lesson)
                    current_lesson = None
                chapters.append(current_chapter)
            title = stripped.split("Chapter:", 1)[1].strip()
            current_chapter = {"title": title, "lessons": []}
        elif stripped.strip().startswith("Lesson:"):
            if current_lesson:
                current_chapter["lessons"].append(current_lesson)
            lesson_title = stripped.strip().split("Lesson:", 1)[1].strip()
            current_lesson = {"title": lesson_title, "videos": []}
        elif stripped.strip().startswith("- ") and current_lesson is not None:
            entry = stripped.strip()[2:].strip()
            if ":" in entry:
                left, url = entry.split(":", 1)
                url = url.strip()
            else:
                left, url = entry, ""
            if "." in left:
                ident, question = left.split(".", 1)
                ident = ident.strip()
                question = question.strip()
            else:
                ident, question = "", left.strip()
            current_lesson["videos"].append({
                "id": ident,
                "prompt": question,
                "url": None if url.upper() == "UNKNOWN" else url,
            })
    if current_lesson and current_chapter:
        current_chapter["lessons"].append(current_lesson)
    if current_chapter:
        chapters.append(current_chapter)
    return chapters

def main():
    raw_path = Path("data/raw_mcv4u.txt")
    text = raw_path.read_text(encoding="utf-8")
    chapters = parse_raw(text)
    payload = {"title": "Calculus and Vectors MCV4U", "chapters": chapters}
    out_path = Path("data/mcv4u.json")
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out_path}")

if __name__ == "__main__":
    main()
