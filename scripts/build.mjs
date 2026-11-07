// Baut die Dankes-Seite:
//   1. Fotos aus src/fotos/<abschnitt>/ verkleinern (max. 1600 px), Metadaten (EXIF/GPS) entfernen, als Base64 einbetten
//   2. Schriften einbetten
//   3. mit StatiCrypt und eigenem Template verschlüsseln → ./index.html
//   4. prüfen (verschlüsselt, Gegenprobe, Grösse) und privat/ aktualisieren (über src/privat.mjs)
// Alles Persönliche (Text, Fotos, Gäste-Texte) liegt in src/ und kommt nie ins Repo.
// Mit --vorschau öffnet sich danach die unverschlüsselte Vorschau im Browser.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { liesPasswort } from "./passwort.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUELLE = path.join(ROOT, "src", "index.html");
const PRIVAT_MODUL = path.join(ROOT, "src", "privat.mjs");
const FOTO_ORDNER = process.env.FOTOS_DIR ? path.resolve(process.env.FOTOS_DIR) : path.join(ROOT, "src", "fotos");
const BUILD = path.join(ROOT, "src", ".build");
const BUILD_SEITE = path.join(BUILD, "index.html");
const BUILD_TEMPLATE = path.join(BUILD, "passwort.html");
const BUILD_STAND = path.join(BUILD, "stand.txt");
const ZIEL = path.join(ROOT, "index.html");
const TEMPLATE = path.join(ROOT, "templates", "passwort.html");
const STATICRYPT_CLI = path.join(ROOT, "node_modules", "staticrypt", "cli", "index.js");

export const SEITEN_URL = "https://yannickluca.github.io/dankeschoen/";
const MAX_BYTES = 6_000_000;
const KLARTEXT_MARKER = "dankeschoen:klartext";
const BILD_ENDUNG = /\.(jpe?g|png|webp|avif|tiff?|heic|heif)$/i;
// Falls die Seite zu gross würde, wird Stufe für Stufe stärker komprimiert
const STUFEN = [
    { max: 1600, q: 80 },
    { max: 1600, q: 72 },
    { max: 1600, q: 64 },
    { max: 1400, q: 62 },
    { max: 1200, q: 60 },
    { max: 1000, q: 56 },
];
const SCHRIFTEN = {
    seite: [
        ["Cormorant Garamond", "500", "normal", "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2"],
        ["Cormorant Garamond", "500", "italic", "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2"],
        ["Jost", "100 900", "normal", "@fontsource-variable/jost/files/jost-latin-wght-normal.woff2"],
    ],
};
SCHRIFTEN.passwort = SCHRIFTEN.seite;

const mb = (bytes) => (bytes / 1_000_000).toFixed(2).replace(".", ",") + " MB";

function abbruch(meldung) {
    console.error(`\n✗ ${meldung}\n`);
    process.exit(1);
}

// Muss exakt der Funktion in templates/passwort.html entsprechen
function normalisieren(wert) {
    return wert
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/ß/g, "ss")
        .replace(/[\s‐-―−_.,;:\/+]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
}

const html = (text) =>
    text.replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);

function schriftenCss(liste) {
    return liste
        .map(([familie, gewicht, stil, datei]) => {
            const base64 = readFileSync(path.join(ROOT, "node_modules", datei)).toString("base64");
            return `@font-face{font-family:"${familie}";font-style:${stil};font-weight:${gewicht};font-display:swap;src:url(data:font/woff2;base64,${base64}) format("woff2")}`;
        })
        .join("\n");
}

// Fotoabschnitte ergeben sich aus den Platzhaltern <!-- FOTOS:name --> in src/index.html (Fotos in src/fotos/name/),
// der Titel für neutrale Alt-Texte aus der Überschrift des Abschnitts
function abschnitte(quelle) {
    return [...quelle.matchAll(/<!-- FOTOS:([\w-]+) -->/g)].map(([, name]) => {
        const h2 = quelle.match(new RegExp(`id="${name}"[\\s\\S]*?<h2[^>]*>([\\s\\S]*?)</h2>`));
        const titel = h2 ? h2[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim() : name;
        return [name, titel];
    });
}

function fotosIn(abschnitt) {
    const ordner = path.join(FOTO_ORDNER, abschnitt);
    if (!existsSync(ordner)) return [];
    return readdirSync(ordner)
        .filter((name) => BILD_ENDUNG.test(name) && !name.startsWith(".") && statSync(path.join(ordner, name)).isFile())
        .sort(new Intl.Collator("de", { numeric: true }).compare)
        .map((name) => path.join(ordner, name));
}

// Alt-Text aus dem Dateinamen («03-ringtausch.jpg» → «Ringtausch»), sonst neutral
function altText(datei, titel, nummer) {
    const name = path
        .basename(datei, path.extname(datei))
        .replace(/^\d+[\s._-]*/, "")
        .replace(/[_-]+/g, " ")
        .trim();
    const technisch = /^(img|dsc|dscf|dscn|pxl|mvimg|photo|foto|image|bild|whatsapp|signal|screenshot)\b/i.test(name);
    if (technisch || !/\p{L}{3}/u.test(name)) return `${titel}, Foto ${nummer}`;
    return name.charAt(0).toUpperCase() + name.slice(1);
}

const eingaben = new Map();
async function eingabeLaden(datei) {
    if (!eingaben.has(datei)) {
        let puffer = readFileSync(datei);
        if (/\.hei[cf]$/i.test(datei)) {
            // sharp kann HEIC (iPhone) nicht lesen – zuerst verlustarm umwandeln
            const { default: heicConvert } = await import("heic-convert");
            puffer = Buffer.from(await heicConvert({ buffer: puffer, format: "JPEG", quality: 0.95 }));
        }
        eingaben.set(datei, puffer);
    }
    return eingaben.get(datei);
}

async function fotoVerarbeiten(datei, { max, q }) {
    const { data, info } = await sharp(await eingabeLaden(datei), { failOn: "none" })
        .rotate() // nach EXIF-Ausrichtung drehen, bevor die Metadaten wegfallen
        .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
        .webp({ quality: q, effort: 6 })
        .toBuffer({ resolveWithObject: true });

    const meta = await sharp(data).metadata();
    if (meta.exif || meta.xmp || meta.iptc) abbruch(`Metadaten in ${path.basename(datei)} nicht entfernt.`);
    return { data, breite: info.width, hoehe: info.height };
}

function galerieHtml(abschnitt, fotos) {
    if (fotos.length === 0) return "";
    const anzahl = fotos.length <= 4 ? String(fotos.length) : "mehr";
    const eintraege = fotos.map(
        (f, i) =>
            `<li><button type="button" class="foto" aria-label="${html(f.alt)} – gross anzeigen">` +
            `<img src="data:image/webp;base64,${f.data.toString("base64")}" width="${f.breite}" height="${f.hoehe}" ` +
            `alt="${html(f.alt)}" loading="${i < 2 ? "eager" : "lazy"}" decoding="async"></button></li>`
    );
    return `<ul class="galerie" data-anzahl="${anzahl}" data-galerie="${abschnitt}">${eintraege.join("")}</ul>`;
}

async function seiteBauen(quelle, stufe) {
    let seite = quelle.replace("/* SCHRIFTEN */", () => schriftenCss(SCHRIFTEN.seite));
    const statistik = {};
    for (const [abschnitt, titel] of abschnitte(quelle)) {
        const dateien = fotosIn(abschnitt);
        const fotos = [];
        for (const [i, datei] of dateien.entries()) {
            fotos.push({ ...(await fotoVerarbeiten(datei, stufe)), alt: altText(datei, titel, i + 1) });
        }
        statistik[titel] = { anzahl: fotos.length, bytes: fotos.reduce((s, f) => s + f.data.length, 0) };
        seite = seite.replace(`<!-- FOTOS:${abschnitt} -->`, () => galerieHtml(abschnitt, fotos));
    }
    return { seite, statistik };
}

function staticrypt(args, passwort) {
    try {
        return execFileSync(process.execPath, [STATICRYPT_CLI, ...args], {
            cwd: ROOT,
            env: { ...process.env, STATICRYPT_PASSWORD: passwort },
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (fehler) {
        abbruch(`StatiCrypt ist fehlgeschlagen:\n${fehler.stdout || ""}${fehler.stderr || ""}`);
    }
}

function vorschauOeffnen(datei) {
    const [befehl, argumente] =
        process.platform === "win32"
            ? ["cmd.exe", ["/c", "start", "", datei]]
            : [process.platform === "darwin" ? "open" : "xdg-open", [datei]];
    spawn(befehl, argumente, { detached: true, stdio: "ignore" }).unref();
}

async function main() {
    const passwort = liesPasswort();
    if (!passwort) abbruch("Kein Passwort in .env – zuerst «npm run passwort» ausführen.");
    if (normalisieren(passwort) !== passwort) {
        abbruch("Das Passwort in .env muss klein geschrieben sein, Wörter mit Bindestrich getrennt (z. B. wort-wort-wort).");
    }
    if (!existsSync(QUELLE)) abbruch("src/index.html fehlt.");
    const quelle = readFileSync(QUELLE, "utf8");
    if (!quelle.includes(KLARTEXT_MARKER)) abbruch(`Der Marker «${KLARTEXT_MARKER}» fehlt in src/index.html (wird für die Prüfung gebraucht).`);

    mkdirSync(BUILD, { recursive: true });
    const template = readFileSync(TEMPLATE, "utf8").replace("/* SCHRIFTEN */", () => schriftenCss(SCHRIFTEN.passwort));
    writeFileSync(BUILD_TEMPLATE, template);

    // Fotos so stark wie nötig, so schwach wie möglich komprimieren
    let ergebnis, stufe;
    for (stufe of STUFEN) {
        ergebnis = await seiteBauen(quelle, stufe);
        const geschaetzt = 2 * Buffer.byteLength(ergebnis.seite) + Buffer.byteLength(template) + 40_000;
        if (geschaetzt <= MAX_BYTES) break;
    }
    writeFileSync(BUILD_SEITE, ergebnis.seite);

    // Aus Passwort + Salt abgeleiteter Schlüssel – dient nur dazu, eine Passwortänderung zu erkennen
    const schluessel = (staticrypt(["--share"], passwort).match(/staticrypt_pwd=([0-9a-f]+)/) || [])[1];
    if (!schluessel) abbruch("Schlüssel konnte nicht abgeleitet werden.");

    // StatiCrypt verschlüsselt jedes Mal mit neuem Zufallswert. Nur neu verschlüsseln, wenn sich Inhalt,
    // Passwortseite oder Passwort geändert haben – sonst gäbe es bei jedem Build einen neuen Commit.
    const stand = createHash("sha256").update(ergebnis.seite).update(template).update(schluessel).digest("hex");
    const verschluesseln = () =>
        staticrypt([path.relative(ROOT, BUILD_SEITE), "-d", ".", "-t", path.relative(ROOT, BUILD_TEMPLATE), "--remember", "0"], passwort);

    // Gegenprobe: mit dem Passwort entschlüsseln und mit der Quelle vergleichen
    const gegenprobe = () => {
        const probeOrdner = path.join(BUILD, "gegenprobe");
        rmSync(probeOrdner, { recursive: true, force: true });
        staticrypt(["index.html", "--decrypt", "-d", path.relative(ROOT, probeOrdner)], passwort);
        const datei = path.join(probeOrdner, "index.html");
        const gleich = existsSync(datei) && readFileSync(datei, "utf8") === ergebnis.seite;
        rmSync(probeOrdner, { recursive: true, force: true });
        return gleich;
    };

    let neuVerschluesselt = false;
    if (!existsSync(ZIEL) || !existsSync(BUILD_STAND) || readFileSync(BUILD_STAND, "utf8") !== stand) {
        verschluesseln();
        neuVerschluesselt = true;
    }
    let gegenprobeOk = gegenprobe();
    if (!gegenprobeOk && !neuVerschluesselt) {
        verschluesseln();
        neuVerschluesselt = true;
        gegenprobeOk = gegenprobe();
    }
    if (gegenprobeOk) writeFileSync(BUILD_STAND, stand);

    // Prüfungen am Ergebnis
    const ausgabe = readFileSync(ZIEL, "utf8");
    const groesse = Buffer.byteLength(ausgabe);
    const pruefungen = [
        [ausgabe.includes('"staticryptEncryptedMsgUniqueVariableName"'), "Inhalt ist verschlüsselt"],
        [!ausgabe.includes(KLARTEXT_MARKER), "kein Klartext in index.html"],
        [!/1drv\.ms|onedrive\.live\.com|sharepoint\.com/i.test(ausgabe), "OneDrive-Link nur verschlüsselt"],
        [!ausgabe.includes("data:image/webp"), "Fotos nur verschlüsselt"],
        [/<meta name="robots" content="noindex/.test(ausgabe), "Passwortseite mit noindex"],
        [groesse <= MAX_BYTES, `Grösse ${mb(groesse)} (Ziel: unter ${mb(MAX_BYTES)})`],
        [gegenprobeOk, "Gegenprobe: Entschlüsseln ergibt exakt die Quelle"],
    ];

    console.log("");
    for (const [titel, { anzahl, bytes }] of Object.entries(ergebnis.statistik)) {
        console.log(`  ${titel}: ${anzahl} Foto${anzahl === 1 ? "" : "s"}${anzahl ? ` (${mb(bytes)})` : ""}`);
    }
    console.log(`  Fotos: max. ${stufe.max} px, WebP-Qualität ${stufe.q}, Metadaten (EXIF/GPS) entfernt`);
    console.log(`  index.html: ${neuVerschluesselt ? "neu verschlüsselt" : "unverändert (Inhalt gleich wie beim letzten Build)"}\n`);
    for (const [ok, text] of pruefungen) console.log(`  ${ok ? "✓" : "✗"} ${text}`);
    if (pruefungen.some(([ok]) => !ok)) abbruch("Build nicht in Ordnung – index.html bitte nicht committen.");

    if (existsSync(PRIVAT_MODUL)) {
        const { privatAktualisieren } = await import(pathToFileURL(PRIVAT_MODUL).href);
        const privat = privatAktualisieren(ROOT, { url: SEITEN_URL, passwort });
        console.log(`  ✓ privat/ aktualisiert${privat.geschrieben.length ? ` (neu: ${privat.geschrieben.join(", ")})` : ""}`);
        if (privat.ersetzt) console.log("  ! Das Passwort hat sich geändert – die Texte in privat/ wurden neu geschrieben.");
    }
    console.log("\n  Vorschau (unverschlüsselt): src/.build/index.html\n");

    if (process.argv.includes("--vorschau")) vorschauOeffnen(BUILD_SEITE);
}

await main();
