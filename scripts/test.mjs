// Testet die Seite im Browser (Edge, Handy-Ansicht) und legt Screenshots in privat/screenshots/ ab.
//   npm test            → Live-Seite auf GitHub Pages
//   npm run test:lokal  → lokale index.html über einen kleinen Server auf localhost
import { createServer } from "node:http";
import { request } from "node:https";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright-core";
import { liesPasswort } from "./passwort.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE_URL = "https://yannickluca.github.io/dankeschoen/";
const LOKAL = process.argv.includes("--lokal");
const AUSGABE = path.join(ROOT, "privat", "screenshots");
const HANDY = { ...devices["iPhone 13"], deviceScaleFactor: 2, locale: "de-CH", timezoneId: "Europe/Zurich", reducedMotion: "reduce" };
const COMPUTER = { viewport: { width: 1280, height: 900 }, locale: "de-CH", timezoneId: "Europe/Zurich", reducedMotion: "reduce" };

const ergebnisse = [];
function pruefe(ok, text) {
    ergebnisse.push([!!ok, text]);
    console.log(`  ${ok ? "✓" : "✗"} ${text}`);
}

function lokalerServer() {
    const seite = readFileSync(path.join(ROOT, "index.html"));
    const server = createServer((req, res) => {
        if (req.url.split("?")[0] === "/dankeschoen/") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(seite);
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    return new Promise((fertig) => server.listen(0, "localhost", () => fertig(server)));
}

// Übertragene Grösse mit gzip (wie im Browser)
function uebertragung(url) {
    return new Promise((fertig, fehler) => {
        request(url, { headers: { "Accept-Encoding": "gzip" } }, (res) => {
            let bytes = 0;
            res.on("data", (teil) => (bytes += teil.length));
            res.on("end", () => fertig({ status: res.statusCode, kodierung: res.headers["content-encoding"], bytes }));
        })
            .on("error", fehler)
            .end();
    });
}

const mb = (bytes) => (bytes / 1_000_000).toFixed(2).replace(".", ",") + " MB";

async function main() {
    const passwort = liesPasswort();
    if (!passwort) throw new Error("Kein Passwort in .env.");
    mkdirSync(AUSGABE, { recursive: true });

    const praefix = LOKAL ? "lokal" : "live";
    // Screenshots des letzten Laufs entfernen, damit nichts Veraltetes liegen bleibt
    for (const datei of readdirSync(AUSGABE)) if (datei.startsWith(`${praefix}-`)) rmSync(path.join(AUSGABE, datei));
    const bild = (name) => path.join(AUSGABE, `${praefix}-${name}.png`);

    const server = LOKAL ? await lokalerServer() : null;
    const basis = LOKAL ? `http://localhost:${server.address().port}/dankeschoen/` : LIVE_URL;
    const fremdeAnfragen = new Set();
    const erlaubterHost = new URL(basis).host;

    console.log(`\nTeste ${LOKAL ? "lokal" : "live"}: ${basis}\n`);
    const browser = await chromium.launch({ channel: "msedge", headless: true });

    async function neuerKontext(optionen = HANDY) {
        const kontext = await browser.newContext(optionen);
        kontext.on("request", (anfrage) => {
            const url = anfrage.url();
            if (!/^(data|blob|about):/.test(url) && new URL(url).host !== erlaubterHost) fremdeAnfragen.add(new URL(url).host);
        });
        return kontext;
    }
    // Die Seite ist offen, sobald der Abschnitt «Fotos & Video» der entschlüsselten Seite da ist
    const inhaltSichtbar = (page) => page.locator("#fotos-video").waitFor({ timeout: 15000 }).then(() => true, () => false);
    async function anmelden(page, eingabe = passwort) {
        await page.goto(basis);
        await page.locator("#staticrypt-password").waitFor({ state: "visible", timeout: 15000 });
        await page.fill("#staticrypt-password", eingabe);
        await page.click(".knopf");
        return inhaltSichtbar(page);
    }
    // Wartet, bis die sofort geladenen Fotos dekodiert sind – sonst zeigt ein früher Screenshot noch eine leere Fläche
    const fotosBereit = (page) =>
        page.evaluate(() => Promise.all([...document.images].filter((img) => img.loading !== "lazy").map((img) => img.decode().catch(() => {}))));
    // Läuft im Browser: hat das Feuerwerk etwas auf seine Leinwand gezeichnet?
    const feuerwerkGezeichnet = () => {
        const leinwand = document.querySelector(".feuerwerk");
        if (!leinwand) return false;
        const pixel = leinwand.getContext("2d").getImageData(0, 0, leinwand.width, leinwand.height).data;
        return new Uint32Array(pixel.buffer).some(Boolean);
    };

    // Handy: Passwortseite, falsches und richtiges Passwort, «Merken»
    const kontext = await neuerKontext();
    const page = await kontext.newPage();
    await page.goto(basis);
    await page.locator("#staticrypt-password").waitFor({ state: "visible", timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    pruefe((await page.title()).startsWith("Dankeschön"), "Passwortseite lädt");
    pruefe(/noindex/.test(await page.locator('meta[name="robots"]').getAttribute("content")), "Passwortseite: noindex gesetzt");
    await page.screenshot({ path: bild("01-passwortseite") });

    await page.fill("#staticrypt-password", "falsches-passwort-test");
    await page.click(".knopf");
    await page.locator("#fehler").waitFor({ state: "visible", timeout: 15000 });
    pruefe((await page.locator("#fehler").innerText()).includes("stimmt leider nicht"), "Falsches Passwort: Fehlermeldung erscheint");
    pruefe(await page.locator("#staticrypt-password").isVisible(), "Falsches Passwort: Seite bleibt gesperrt");
    await page.screenshot({ path: bild("02-falsches-passwort") });

    // so getippt, wie es Gäste manchmal tun: Grossbuchstaben und Leerzeichen statt Bindestrich
    const schlampig = passwort.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") + " ";
    await page.fill("#staticrypt-password", schlampig);
    await page.click(".knopf");
    pruefe(await inhaltSichtbar(page), "Richtiges Passwort (mit Grossbuchstaben und Leerzeichen getippt) öffnet die Seite");
    await page.evaluate(() => document.fonts.ready);
    pruefe(/noindex/.test(await page.locator('meta[name="robots"]').getAttribute("content")), "Inhaltsseite: noindex gesetzt");
    pruefe(await page.evaluate(() => !!localStorage.getItem("dankeschoen_schluessel")), "«Auf diesem Gerät merken» gespeichert");
    await fotosBereit(page);
    await page.screenshot({ path: bild("03-seite-oben") });
    // Fotos laden erst beim Scrollen (lazy) – für den Ganzseiten-Screenshot einmal durchscrollen
    await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 40));
        }
        await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
        window.scrollTo(0, 0);
    });
    await page.screenshot({ path: bild("04-seite-ganz"), fullPage: true });
    pruefe(!(await page.evaluate(feuerwerkGezeichnet)), "Bei «Bewegung reduzieren» bleibt das Feuerwerk aus");

    await page.reload();
    pruefe(await inhaltSichtbar(page), "Erneut öffnen: Seite ist ohne Passwort offen (Gerät gemerkt)");

    // Vollbild-Ansicht der Fotos
    const erstesFoto = page.locator(".galerie .foto").first();
    if (await erstesFoto.count()) {
        const anzahl = await erstesFoto.evaluate((el) => el.closest(".galerie").querySelectorAll("img").length);
        await erstesFoto.click();
        await page.locator(".lightbox[open]").waitFor({ timeout: 5000 });
        if (anzahl > 1) {
            // Wischen nach links simulieren
            await page.locator(".lightbox").evaluate((dialog) => {
                const punkt = (x) => new Touch({ identifier: 1, target: dialog, clientX: x, clientY: 300 });
                dialog.dispatchEvent(new TouchEvent("touchstart", { touches: [punkt(300)], changedTouches: [punkt(300)], bubbles: true }));
                dialog.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [punkt(120)], bubbles: true }));
            });
            pruefe((await page.locator(".lb-zaehler").innerText()) === `2 / ${anzahl}`, "Vollbild: Wischen zeigt das nächste Foto");
        }
        await page.screenshot({ path: bild("05-vollbild") });

        // Im Vollbild vergrössern: zwei Finger auseinanderziehen, danach zeigt ein Tipp wieder das ganze Bild
        const zoom = () => page.locator(".lb-bild").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
        const cdp = await kontext.newCDPSession(page);
        const finger = (abstand) => [-abstand, abstand].map((dx, id) => ({ x: 195 + dx, y: 330, id }));
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: finger(30) });
        for (const abstand of [50, 70, 90, 110, 120]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: finger(abstand) });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        pruefe((await zoom()) > 2.5, "Vollbild: zwei Finger auseinanderziehen vergrössert das Foto");
        await page.screenshot({ path: bild("05-vollbild-gezoomt") });
        await page.touchscreen.tap(195, 330);
        pruefe((await zoom()) === 1, "Vollbild: Antippen zeigt wieder das ganze Foto");
        await page.keyboard.press("Escape");
        pruefe(!(await page.locator(".lightbox[open]").count()), "Vollbild schliesst wieder");
    } else {
        console.log("  · (noch keine Fotos in src/fotos – Vollbild-Test übersprungen)");
    }
    const oneDriveLink = await page.locator("#download-aktiv a.knopf").getAttribute("href");
    await kontext.close();

    // Computer mit frischem Browser: Passwort eingeben wie ein Gast
    const kontextPc = await neuerKontext(COMPUTER);
    const pagePc = await kontextPc.newPage();
    pruefe(await anmelden(pagePc), "Computer (frischer Browser): Link + Passwort öffnen die Seite");
    await pagePc.evaluate(() => document.fonts.ready);
    await fotosBereit(pagePc);
    await pagePc.screenshot({ path: bild("07-computer") });
    await kontextPc.close();

    // Feuerwerk im Kopf der Seite – zündet kurz nach dem Öffnen (die übrigen Tests laufen mit «Bewegung reduzieren»)
    const kontextFw = await neuerKontext({ ...HANDY, reducedMotion: "no-preference" });
    const pageFw = await kontextFw.newPage();
    await anmelden(pageFw);
    const gezuendet = await pageFw.waitForFunction(feuerwerkGezeichnet, null, { timeout: 8000, polling: 100 }).then(() => true, () => false);
    pruefe(gezuendet, "Feuerwerk startet beim Öffnen der Seite");
    await pageFw.waitForTimeout(1600);
    await pageFw.screenshot({ path: bild("09-feuerwerk") });
    await kontextFw.close();

    // Datumsweiche – 31.12.2026 23:59 noch Download, 1.1.2027 00:00 Hinweis
    for (const [zeit, erwartet] of [["2026-12-31T23:59:30+01:00", "aktiv"], ["2027-01-01T00:00:30+01:00", "beendet"]]) {
        const k = await neuerKontext();
        await k.clock.setFixedTime(new Date(zeit));
        const p = await k.newPage();
        await anmelden(p);
        const linkDa = (await p.locator("#download-aktiv a.knopf").count()) > 0;
        const hinweisDa = (await p.getByText("ist nun beendet").count()) > 0;
        const datum = zeit.slice(0, 16).replace("T", " ");
        if (erwartet === "aktiv") pruefe(linkDa && !hinweisDa, `Datumsweiche ${datum}: Download-Block sichtbar`);
        else {
            pruefe(!linkDa && hinweisDa, `Datumsweiche ${datum}: Hinweis «beendet», kein OneDrive-Link mehr`);
            await p.locator("#fotos-video").scrollIntoViewIfNeeded();
            await p.evaluate(() => document.fonts.ready);
            await p.locator("#fotos-video").screenshot({ path: bild("06-ab-2027") });
        }
        await k.close();
    }

    pruefe(fremdeAnfragen.size === 0, `Keine externen Dienste/Tracker geladen${fremdeAnfragen.size ? ": " + [...fremdeAnfragen].join(", ") : ""}`);

    // OneDrive-Link aus der entschlüsselten Seite erreichbar (ohne Anmeldung)
    const kontextOd = await browser.newContext(HANDY);
    const pageOd = await kontextOd.newPage();
    const antwort = await pageOd.goto(oneDriveLink, { waitUntil: "domcontentloaded", timeout: 60000 });
    await pageOd.waitForTimeout(8000);
    const host = new URL(pageOd.url()).host;
    const text = await pageOd.locator("body").innerText();
    pruefe(antwort.ok() && /(^|\.)onedrive\.live\.com$/.test(host), `OneDrive-Link erreichbar (${host})`);
    pruefe(!/login\.live\.com/.test(pageOd.url()) && /Fotos|Film/.test(text), "OneDrive-Ordner ohne Anmeldung sichtbar");
    await pageOd.screenshot({ path: bild("08-onedrive") });
    await kontextOd.close();

    await browser.close();
    if (server) server.close();

    if (!LOKAL) {
        const { status, kodierung, bytes } = await uebertragung(LIVE_URL);
        pruefe(status === 200, `Live: HTTP ${status}, übertragen ${mb(bytes)}${kodierung ? ` (${kodierung})` : ""}`);
    }

    const fehler = ergebnisse.filter(([ok]) => !ok).length;
    console.log(`\n${fehler ? `✗ ${fehler} Test(s) fehlgeschlagen` : "✓ Alle Tests bestanden"} – Screenshots: privat/screenshots/${praefix}-*.png\n`);
    process.exit(fehler ? 1 : 0);
}

await main();
