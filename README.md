# meguro

meguro helps Japanese learners make comparison cards for words that are easy to confuse. Enter two to four terms, pull definitions and examples from Jitendex when available, then export the finished comparison note to Anki through AnkiConnect.

## Start using the hosted app

Visit the site:

```text
https://meguro.yuan.tokyo
```

To export cards into Anki, set up Anki on the same computer as your browser:

1. Install the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on in Anki.
2. Download and import the bundled [`meguro.apkg`](anki/meguro/meguro.apkg) package into Anki. This adds the `meguro` note type and starter deck.
3. Start Anki and keep it open.
4. In meguro, add at least two terms, choose or enter a target deck, then export.

If AnkiConnect rejects the hosted app with a CORS or permission error, add this origin to AnkiConnect's `webCorsOriginList`, then restart Anki:

You can achieve this by going to Anki > Tools > Add-Ons > AnkiConnect > Config and making sure it looks something like this:

```json
{
    "apiKey": null,
    "apiLogPath": null,
    "ignoreOriginList": [],
    "webBindAddress": "127.0.0.1",
    "webBindPort": 8765,
    "webCorsOriginList": [
        "http://localhost",
        "https://meguro.yuan.tokyo"
        // OTHER ORIGINS HERE
    ]
}
```

## Make a card

1. Enter a term in each comparison slot.
2. Use dictionary search to apply a Jitendex term, definition, and example, or write your own definition manually.
3. Add more terms if needed. meguro supports up to four terms per comparison card.
4. Review the Anki payload panel if you want to see the exact fields that will be sent.
5. Open export, select an existing deck or type a new deck name, and send the note to Anki.

The exported note uses the `meguro` Anki note type. Empty third and fourth slots are allowed.

## Run locally with Docker

From the repository root:

```powershell
docker compose up --build
```

Then open:

```text
http://127.0.0.1:4000
```

The backend listens on `http://127.0.0.1:4001` and downloads/indexes Jitendex into the Docker volume `dictionary-data` on first start.

For local AnkiConnect export, add this origin to `webCorsOriginList` if AnkiConnect returns `403`:

```text
http://127.0.0.1:4000
```

## Run locally without Docker

Start the backend:

```powershell
cd backend
npm install
npm run dev
```

In another terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open the frontend at `http://127.0.0.1:4000`.

## Useful commands

```powershell
cd backend
npm test
```

```powershell
cd frontend
npm run build
npm run test:dictionary
```

## Project layout

- `frontend/` - Vite React card builder and AnkiConnect export UI.
- `backend/` - Fastify dictionary API backed by an indexed Jitendex SQLite store.
- `anki/meguro/` - Anki note type templates, styling, and optional `.apkg` generator.
