from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "content" / "playlists.json"
OUTPUT = ROOT / "content" / "playlist-data.json"


def run_ytdlp(url: str) -> dict[str, Any]:
    command = [
        "yt-dlp",
        "--flat-playlist",
        "--dump-single-json",
        "--ignore-errors",
        "--no-warnings",
        url,
    ]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    return json.loads(completed.stdout)


def normalise_entry(entry: dict[str, Any], position: int) -> dict[str, Any]:
    return {
        "position": position,
        "video_id": entry.get("id"),
        "title": entry.get("title") or f"Lesson {position}",
        "duration_seconds": entry.get("duration"),
        "url": entry.get("url") or entry.get("webpage_url"),
        "channel": entry.get("channel") or entry.get("uploader"),
    }


def main() -> None:
    sources = json.loads(MANIFEST.read_text(encoding="utf-8"))
    imported: list[dict[str, Any]] = []

    for source in sources:
        raw = run_ytdlp(source["source_url"])
        entries = [entry for entry in raw.get("entries", []) if entry and entry.get("id")]
        imported.append(
            {
                "playlist_id": source["playlist_id"],
                "source_url": source["source_url"],
                "title": raw.get("title") or raw.get("playlist_title") or source["playlist_id"],
                "description": raw.get("description") or "",
                "channel": raw.get("channel") or raw.get("uploader") or raw.get("playlist_uploader"),
                "thumbnail": raw.get("thumbnail"),
                "lesson_count": len(entries),
                "total_duration_seconds": sum(int(item.get("duration") or 0) for item in entries),
                "lessons": [normalise_entry(entry, index) for index, entry in enumerate(entries, start=1)],
            }
        )

    OUTPUT.write_text(json.dumps(imported, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Imported {len(imported)} playlists into {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
