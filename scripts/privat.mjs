// Hält privat/ aktuell: Share-Link, Nachricht an die Gäste, Erinnerung und Kalenderdatei.
// Bestehende Texte bleiben unangetastet – ausser der Share-Link hat sich geändert (z. B. nach «npm run notfall»).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TRENNER = (titel) => `────────── ${titel} ──────────`;

function nachricht(link) {
    return `NACHRICHT AN DIE GÄSTE
Privat verschicken (einzeln oder in der Gäste-Gruppe), nie öffentlich posten.
Der Link öffnet die Seite direkt, ohne Passwort.

${TRENNER("WhatsApp")}

Ihr Lieben

Nochmals von Herzen danke, dass ihr mit uns gefeiert habt – an der Ziviltrauung und in Colmegna! Auf unserer kleinen Dankes-Seite findet ihr ein paar Highlights und alle Fotos und das Video zum Herunterladen:

${link}

Der Link öffnet die Seite direkt – bitte teilt ihn nicht öffentlich. Fotos und Video stehen bis und mit 31. Dezember 2026 bereit.

Alles Liebe
Luana & Yannick

${TRENNER("E-Mail")}

Betreff: Dankeschön – unsere Hochzeitsfotos und das Video

Liebe Familie, liebe Freundinnen und Freunde

Nochmals von Herzen danke, dass ihr mit uns gefeiert habt – an der Ziviltrauung am 26. Juni und an unserem Hochzeitsfest in Colmegna am 22. August. Auf unserer kleinen Dankes-Seite findet ihr ein paar Highlights und alle Fotos und das Video zum Herunterladen:

${link}

Der Link öffnet die Seite direkt. Bitte teilt ihn nicht öffentlich. Fotos und Video könnt ihr bis und mit 31. Dezember 2026 anschauen und herunterladen.

Alles Liebe
Luana & Yannick
`;
}

function erinnerung(link) {
    return `ERINNERUNG AN DIE GÄSTE (um den 15. Dezember 2026, optional)
Privat verschicken, nie öffentlich posten.

${TRENNER("WhatsApp")}

Ihr Lieben, eine kleine Erinnerung: Unsere Hochzeitsfotos und das Video könnt ihr noch bis und mit 31. Dezember 2026 herunterladen. Danach ist der Download beendet.

${link}

Alles Liebe
Luana & Yannick

${TRENNER("E-Mail")}

Betreff: Erinnerung – Hochzeitsfotos noch bis 31. Dezember herunterladen

Liebe Familie, liebe Freundinnen und Freunde

Eine kleine Erinnerung: Unsere Hochzeitsfotos und das Video könnt ihr noch bis und mit 31. Dezember 2026 anschauen und herunterladen. Danach ist der Download beendet.

${link}

Alles Liebe
Luana & Yannick
`;
}

// iCalendar-Text: Sonderzeichen maskieren, Zeilen nach 75 Bytes falten, CRLF
const icsText = (text) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
function falten(zeile) {
    const teile = [];
    let aktuell = "";
    for (const zeichen of zeile) {
        const grenze = teile.length === 0 ? 75 : 74;
        if (Buffer.byteLength(aktuell + zeichen) > grenze) {
            teile.push(aktuell);
            aktuell = "";
        }
        aktuell += zeichen;
    }
    teile.push(aktuell);
    return teile.join("\r\n ");
}

function kalender() {
    const stempel = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const termine = [
        {
            uid: "dankeschoen-erinnerung-2026-12-15",
            beginn: "20261215T090000",
            ende: "20261215T093000",
            titel: "Erinnerung an die Gäste schicken",
            text: "Optional: Erinnerung privat per WhatsApp oder E-Mail verschicken, nie öffentlich posten. Text: privat/erinnerung-gaeste.txt im Projektordner dankeschoen. Der Download ist bis und mit 31.12.2026 möglich.",
        },
        {
            uid: "dankeschoen-onedrive-2027-01-01",
            beginn: "20270101T100000",
            ende: "20270101T103000",
            titel: "OneDrive-Freigabe beenden",
            text: "OneDrive öffnen, Ordner «Hochzeit_Bachmann» wählen, «Zugriff verwalten» und den Freigabelink löschen. Die Dankes-Seite zeigt ab heute automatisch «Download beendet».",
        },
    ];
    const zeilen = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//dankeschoen//Erinnerungen//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const t of termine) {
        zeilen.push(
            "BEGIN:VEVENT",
            `UID:${t.uid}@yannickluca.github.io`,
            `DTSTAMP:${stempel}`,
            `DTSTART:${t.beginn}`,
            `DTEND:${t.ende}`,
            `SUMMARY:${icsText(t.titel)}`,
            `DESCRIPTION:${icsText(t.text)}`,
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:${icsText(t.titel)}`,
            "TRIGGER:PT0M",
            "END:VALARM",
            "END:VEVENT"
        );
    }
    zeilen.push("END:VCALENDAR");
    return zeilen.map(falten).join("\r\n") + "\r\n";
}

export function privatAktualisieren(root, shareLink) {
    const ordner = path.join(root, "privat");
    mkdirSync(ordner, { recursive: true });

    const linkDatei = path.join(ordner, "share-link.txt");
    const alterLink = existsSync(linkDatei) ? readFileSync(linkDatei, "utf8").trim() : null;
    const linkNeu = alterLink !== shareLink;
    writeFileSync(linkDatei, shareLink + "\n");

    const geschrieben = [];
    let ersetzt = false;
    for (const [name, inhalt] of [
        ["nachricht-gaeste.txt", nachricht(shareLink)],
        ["erinnerung-gaeste.txt", erinnerung(shareLink)],
    ]) {
        const datei = path.join(ordner, name);
        const vorhanden = existsSync(datei);
        if (!vorhanden || linkNeu) {
            writeFileSync(datei, inhalt);
            geschrieben.push(name);
            ersetzt ||= vorhanden;
        }
    }

    const ics = path.join(ordner, "erinnerungen.ics");
    if (!existsSync(ics)) {
        writeFileSync(ics, kalender());
        geschrieben.push("erinnerungen.ics");
    }
    return { linkNeu, ersetzt, geschrieben };
}
