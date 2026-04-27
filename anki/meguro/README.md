# meguro Anki Card (MVP)

This folder contains a complete Anki note template for comparison cards with up to 4 terms.

## Note type contract

Create a note type named `meguro` with these fields:

1. `Term1`
2. `Def1`
3. `Ex1`
4. `Term2`
5. `Def2`
6. `Ex2`
7. `Term3`
8. `Def3`
9. `Ex3`
10. `Term4`
11. `Def4`
12. `Ex4`

Use inline furigana in `TermN` values, for example:

`Word[reading]`

## Template install

In Anki (`Browse` -> `Notes` -> `Manage Note Types`):

1. Create note type `meguro`.
2. Add the fields above.
3. Open `Cards...`.
4. Paste:
   - `anki/meguro/front.html` into **Front Template**
   - `anki/meguro/back.html` into **Back Template**
   - `anki/meguro/style.css` into **Styling**

## Behavior

- Front shows only the compared terms.
- Back shows term (with furigana), definition, and example.
- Order is shuffled deterministically by local day (`YYYY-MM-DD`) and term content.
- If JavaScript fails or is unavailable, order stays static (`Term1` -> `Term4`).

## Authoring notes

- Leave any slot empty to use fewer than 4 terms.
- `DefN` and `ExN` accept plain text or simple HTML.
- Keep one compared item per slot for predictable rendering.

## Generate .apkg

From `anki/meguro`:

1. Install dependency: `pip install genanki`
2. Generate package: `python generate_apkg.py`

Optional flags:

- `python generate_apkg.py --output my-meguro.apkg`
- `python generate_apkg.py --deck-name "meguro::My Deck"`

## Bundle Noto Sans JP With The Card

If Anki does not have `Noto Sans JP` installed locally, bundle the font file:

1. Put the font file in `anki/meguro` and prefix with `_`, for example:
   - `_NotoSansJP-Regular.woff2`
2. Keep the `@font-face` rule in `style.css` pointing to that filename.
3. Rebuild the package: `python generate_apkg.py`

`generate_apkg.py` now automatically includes local `_*.woff2`, `_*.woff`,
`_*.ttf`, and `_*.otf` files as package media.
