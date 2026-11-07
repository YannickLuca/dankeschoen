// Testet die Seite im Browser (Edge, Handy-Ansicht) und legt Screenshots in privat/screenshots/ ab.
//   npm test            → Live-Seite auf GitHub Pages
//   npm run test:lokal  → lokale index.html über einen kleinen Server auf localhost
import { createServer } from "node:http";
import { request } from "node:https";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright-core";
import { liesPasswort } from "./passwort.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE_URL = "https://yannickluca.github.io/dankeschoen/";
const LOKAL = process.argv.includes("--lokal");
const AUSGABE = path.join(ROOT, "privat", "screenshots");
const HANDY = { ...devices["iPhone 13"], deviceScaleFactor: 2, locale: "de-CH", timezoneId: "Europe/Zurich", reducedMotion: "reduce" };

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
    const shareDatei = path.join(ROOT, "privat", "share-link.txt");
    if (!passwort || !existsSync(shareDatei)) throw new Error("Passwort (.env) oder privat/share-link.txt fehlt – zuerst «npm run build».");
    mkdirSync(AUSGABE, { recursive: true });

    const server = LOKAL ? await lokalerServer() : null;
    const basis = LOKAL ? `http://localhost:${server.address().port}/dankeschoen/` : LIVE_URL;
    const schluessel = readFileSync(shareDatei, "utf8").trim().split("#")[1];
    const shareLink = `${basis}#${schluessel}`;
    const praefix = LOKAL ? "lokal" : "live";
    const bild = (name) => path.join(AUSGABE, `${praefix}-${name}.png`);
    const fremdeAnfragen = new Set();
    const erlaubterHost = new URL(basis).host;

    console.log(`\nTeste ${LOKAL ? "lokal" : "live"}: ${basis}\n`);
    const browser = await chromium.launch({ channel: "msedge", headless: true });

    async function neuerKontext(optionen = {}) {
        const kontext = await browser.newContext({ ...HANDY, ...optionen });
        kontext.on("request", (anfrage) => {
            const url = anfrage.url();
            if (!/^(data|blob|about):/.test(url) && new URL(url).host !== erlaubterHost) fremdeAnfragen.add(new URL(url).host);
        });
        return kontext;
    }
    const inhaltSichtbar = (page) =>
        page.getByText("Liebe Familie, liebe Freundinnen und Freunde").waitFor({ timeout: 15000 }).then(() => true, () => false);

    // 1–4: Passwortseite, falsches und richtiges Passwort, «Merken»
    const kontext = await neuerKontext();
    const page = await kontext.newPage();
    await page.goto(basis);
    await page.locator("#staticrypt-password").waitFor({ state: "visible", timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    pruefe(await page.title() === "Dankeschön · Luana & Yannick", "Passwortseite lädt (Titel stimmt)");
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

    await page.reload();
    pruefe(await inhaltSichtbar(page), "Neu laden: Seite öffnet ohne Passwort (gemerkt)");

    // Vollbild-Ansicht der Fotos
    const fotos = await page.locator(".galerie .foto").count();
    if (fotos > 0) {
        await page.locator(".galerie .foto").first().click();
        await page.locator(".lightbox[open]").waitFor({ timeout: 5000 });
        const anzahl = await page.locator("#ziviltrauung .foto, #colmegna .foto").first().evaluate((el) => el.closest(".galerie").querySelectorAll("img").length);
        if (anzahl > 1) {
            // Wischen nach links simulieren
            await page.locator(".lightbox").evaluate((dialog) => {
                const punkt = (x) => new Touch({ identifier: 1, target: dialog, clientX: x, clientY: 300 });
                dialog.dispatchEvent(new TouchEvent("touchstart", { touches: [punkt(300)], changedTouches: [punkt(300)], bubbles: true }));
                dialog.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [punkt(120)], bubbles: true }));
            });
            pruefe((await page.locator(".lb-zaehler").innerText()) === `2 / ${anzahl}`, "Vollbild: Wischen zeigt das nächste Foto");
        }
        await page.screenshot({ path: bild("08-vollbild") });
        await page.keyboard.press("Escape");
        pruefe(!(await page.locator(".lightbox[open]").count()), "Vollbild schliesst wieder");
    } else {
        console.log("  · (noch keine Fotos in src/fotos – Vollbild-Test übersprungen)");
    }
    const oneDriveLink = await page.locator("#download-aktiv a.knopf").getAttribute("href");
    await kontext.close();

    // 5: Share-Link in frischem Browser
    const kontext2 = await neuerKontext();
    const page2 = await kontext2.newPage();
    await page2.goto(shareLink);
    pruefe(await inhaltSichtbar(page2), "Share-Link öffnet die Seite ohne Passwort");
    pruefe(!page2.url().includes("staticrypt_pwd"), "Share-Link: Schlüssel verschwindet aus der Adresszeile");
    await page2.evaluate(() => document.fonts.ready);
    await page2.screenshot({ path: bild("05-share-link") });
    await kontext2.close();

    // 6: veralteter / ungültiger Link → Passwortfeld statt endlosem Laden
    const kontext3 = await neuerKontext();
    const page3 = await kontext3.newPage();
    await page3.goto(`${basis}#staticrypt_pwd=${"0".repeat(64)}&remember_me`);
    await page3.locator("#staticrypt-password").waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    pruefe(await page3.locator("#staticrypt-password").isVisible(), "Ungültiger Link: Passwortfeld erscheint (kein endloses Laden)");
    await page3.evaluate(() => document.fonts.ready);
    await page3.screenshot({ path: bild("06-ungueltiger-link") });
    await kontext3.close();

    // 7: Datumsweiche – 31.12.2026 23:59 noch Download, 1.1.2027 00:00 Hinweis
    for (const [zeit, erwartet] of [["2026-12-31T23:59:30+01:00", "aktiv"], ["2027-01-01T00:00:30+01:00", "beendet"]]) {
        const k = await neuerKontext();
        await k.clock.setFixedTime(new Date(zeit));
        const p = await k.newPage();
        await p.goto(shareLink);
        await inhaltSichtbar(p);
        const linkDa = (await p.locator("#download-aktiv a.knopf").count()) > 0;
        const hinweisDa = (await p.getByText("ist nun beendet").count()) > 0;
        const datum = zeit.slice(0, 16).replace("T", " ");
        if (erwartet === "aktiv") pruefe(linkDa && !hinweisDa, `Datumsweiche ${datum}: Download-Block sichtbar`);
        else {
            pruefe(!linkDa && hinweisDa, `Datumsweiche ${datum}: Hinweis «beendet», kein OneDrive-Link mehr`);
            await p.locator("#fotos-video").scrollIntoViewIfNeeded();
            await p.evaluate(() => document.fonts.ready);
            await p.locator("#fotos-video").screenshot({ path: bild("07-ab-2027") });
        }
        await k.close();
    }

    // Desktop-Ansicht
    const kontext4 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-CH", reducedMotion: "reduce" });
    const page4 = await kontext4.newPage();
    await page4.goto(shareLink);
    await inhaltSichtbar(page4);
    await page4.evaluate(() => document.fonts.ready);
    await page4.screenshot({ path: bild("10-desktop") });
    await kontext4.close();

    pruefe(fremdeAnfragen.size === 0, `Keine externen Dienste/Tracker geladen${fremdeAnfragen.size ? ": " + [...fremdeAnfragen].join(", ") : ""}`);

    // 9: OneDrive-Link aus der entschlüsselten Seite erreichbar (ohne Anmeldung)
    const kontext5 = await browser.newContext({ ...HANDY });
    const page5 = await kontext5.newPage();
    const antwort = await page5.goto(oneDriveLink, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page5.waitForTimeout(8000);
    const host = new URL(page5.url()).host;
    const text = await page5.locator("body").innerText();
    pruefe(antwort.ok() && /(^|\.)onedrive\.live\.com$/.test(host), `OneDrive-Link erreichbar (${host})`);
    pruefe(!/login\.live\.com/.test(page5.url()) && /Fotos|Film/.test(text), "OneDrive-Ordner ohne Anmeldung sichtbar");
    await page5.screenshot({ path: bild("09-onedrive") });
    await kontext5.close();

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
