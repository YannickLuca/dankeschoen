// Erzeugt ein zufälliges Passwort aus 5 Wörtern und speichert es in .env (STATICRYPT_PASSWORD).
// Ein bestehendes Passwort wird nie überschrieben – ausser mit --neu (Notfall).
import { randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WOERTER } from "./woerter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_DATEI = path.join(ROOT, ".env");
const ANZAHL_WOERTER = 5;

export function erzeugePasswort() {
    const woerter = [];
    while (woerter.length < ANZAHL_WOERTER) {
        const wort = WOERTER[randomInt(WOERTER.length)];
        if (!woerter.includes(wort)) woerter.push(wort);
    }
    return woerter.join("-");
}

export function liesPasswort() {
    if (!existsSync(ENV_DATEI)) return null;
    const treffer = readFileSync(ENV_DATEI, "utf8").match(/^STATICRYPT_PASSWORD=(.*)$/m);
    return treffer ? treffer[1].trim().replace(/^["']|["']$/g, "") : null;
}

export function speicherePasswort({ neu = false } = {}) {
    if (liesPasswort() && !neu) {
        console.log("Passwort existiert bereits in .env – nichts geändert.");
        return false;
    }
    const zeile = `STATICRYPT_PASSWORD=${erzeugePasswort()}`;
    const alt = existsSync(ENV_DATEI) ? readFileSync(ENV_DATEI, "utf8") : "";
    const inhalt = /^STATICRYPT_PASSWORD=.*$/m.test(alt)
        ? alt.replace(/^STATICRYPT_PASSWORD=.*$/m, zeile)
        : `${alt}${alt && !alt.endsWith("\n") ? "\n" : ""}${zeile}\n`;
    writeFileSync(ENV_DATEI, inhalt);

    const bit = (ANZAHL_WOERTER * Math.log2(WOERTER.length)).toFixed(0);
    console.log(
        `Neues Passwort in .env gespeichert (${ANZAHL_WOERTER} Wörter aus ${WOERTER.length}, ca. ${bit} Bit Zufall).`
    );
    return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    speicherePasswort({ neu: process.argv.includes("--neu") });
}
