# meguro frontend card maker

A Vite React app for creating `meguro` comparison notes and exporting them to Anki through AnkiConnect.

## Run locally

```powershell
cd frontend
npm install
npm run dev
```

## AnkiConnect modes

The export panel starts in mock mode. Mock mode uses the same AnkiConnect payload shape as the real client and logs requests/responses to the browser console.

Disable mock mode to call AnkiConnect directly at:

```text
http://127.0.0.1:8765
```

This matches Yomitan's direct AnkiConnect setup. If the browser gets a `403`,
add this app's exact origin to AnkiConnect's `webCorsOriginList`, for example
`http://127.0.0.1:4000`, and restart Anki. You can override the endpoint with
`VITE_ANKI_CONNECT_URL`.

The app validates that Anki has a `meguro` note type with the fields documented in `anki/meguro/README.md`. It does not auto-create or mutate the note type.

## Dictionary Storage

The dictionary panel imports a Jitendex Yomitan zip from a local file, indexes `term_bank_*.json`, and stores a compact search index in IndexedDB. Later visits load the local IndexedDB copy instead of importing the zip again.

Download source:

```text
https://jitendex.org/pages/downloads.html
```

Jitendex attribution is shown in the UI after indexing.
