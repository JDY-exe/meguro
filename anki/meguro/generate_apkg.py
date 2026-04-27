#!/usr/bin/env python3
"""Generate a meguro .apkg package with one example card.

Usage:
  python generate_apkg.py
  python generate_apkg.py --output meguro-example.apkg --deck-name "Meguro Demo"

Requires:
  pip install genanki
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

try:
    import genanki
except Exception as exc:  # pragma: no cover - runtime guidance
    print("Missing dependency: genanki", file=sys.stderr)
    print("Install with: pip install genanki", file=sys.stderr)
    raise SystemExit(1) from exc


# Stable IDs. Change only if you intentionally want a different model/deck identity.
MODEL_ID = 1607392319
DECK_ID = 2059400110


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def collect_media_files(base_dir: Path) -> list[str]:
    """Collect Anki media files bundled with the note template.

    Convention: template-level static assets should start with '_' so Anki
    does not treat them as unused media.
    """
    patterns = ("_*.woff2", "_*.woff", "_*.ttf", "_*.otf")
    media: list[str] = []
    for pattern in patterns:
        for path in sorted(base_dir.glob(pattern)):
            if path.is_file():
                media.append(str(path.resolve()))
    return media


def build_model(base_dir: Path) -> genanki.Model:
    front = read_text(base_dir / "front.html")
    back = read_text(base_dir / "back.html")
    css = read_text(base_dir / "style.css")

    return genanki.Model(
        MODEL_ID,
        "meguro",
        fields=[
            {"name": "Term1"},
            {"name": "Def1"},
            {"name": "Ex1"},
            {"name": "Term2"},
            {"name": "Def2"},
            {"name": "Ex2"},
            {"name": "Term3"},
            {"name": "Def3"},
            {"name": "Ex3"},
            {"name": "Term4"},
            {"name": "Def4"},
            {"name": "Ex4"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": front,
                "afmt": back,
            }
        ],
        css=css,
    )


def example_note(model: genanki.Model) -> genanki.Note:
    return genanki.Note(
        model=model,
        fields=[
            "止[と]めておく",
            "to stop.",
            "車[くるま]を止[と]めておく。",
            "引[ひ]き止[と]めておく",
            "to hold someone back so they do not leave.",
            "駅[えき]で友達[ともだち]を引[ひ]き止[と]めておいた。",
            "食[く]い止[と]めきる",
            "to check an increase or spread, often when damage or risk must be contained before the situation worsens.",
            "被害[ひがい]の拡大[かくだい]を食[く]い止[と]めきる。",
            "書[か]き留[と]めておきたい",
            "to write something down and keep it for later reference, with an explicit nuance of preserving details so they are not forgotten during follow-up work.",
            "要点[ようてん]をノートに書[か]き留[と]めておきたい。",
        ],
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build meguro example .apkg")
    parser.add_argument(
        "--output",
        default="meguro-example.apkg",
        help="Output .apkg filename (default: meguro-example.apkg)",
    )
    parser.add_argument(
        "--deck-name",
        default="meguro::Demo",
        help='Deck name (default: "meguro::Demo")',
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    base_dir = Path(__file__).resolve().parent
    out_path = (base_dir / args.output).resolve()

    model = build_model(base_dir)
    deck = genanki.Deck(DECK_ID, args.deck_name)
    deck.add_note(example_note(model))

    media_files = collect_media_files(base_dir)
    package = genanki.Package(deck)
    package.media_files = media_files
    package.write_to_file(str(out_path))

    print(f"Wrote: {out_path}")
    print(f"Bundled media files: {len(media_files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

