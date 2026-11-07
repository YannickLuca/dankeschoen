# dankeschoen

Kleine, passwortgeschützte Dankes-Seite für unsere Hochzeitsgäste, veröffentlicht mit GitHub Pages.

Die Seite ist mit [StatiCrypt](https://github.com/robinmoisson/staticrypt) verschlüsselt (AES-256, Entschlüsselung im Browser). Text und Fotos liegen nur lokal und sind nicht in diesem Repository.

- `npm run build` – Seite aus `src/` bauen und zu `index.html` verschlüsseln
- `npm run vorschau` – bauen und die unverschlüsselte Vorschau lokal öffnen
- `npm run test:lokal` / `npm test` – Browser-Tests lokal bzw. auf der Live-Seite
- `npm run veroeffentlichen` – bauen, committen und pushen

`.staticrypt.json` enthält den Salt und darf nie gelöscht werden – sonst funktionieren gespeicherte Logins und Gäste-Links nicht mehr.
