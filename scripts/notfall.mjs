// Notfall: Passwort, Gäste-Link oder OneDrive-Link ist öffentlich geworden.
// Vorher in OneDrive die alte Freigabe löschen, neu freigeben und den neuen Link in src/index.html eintragen.
// Dann: neues Passwort → neu bauen → veröffentlichen. Alte Gäste-Links und gespeicherte Logins werden ungültig,
// die neuen Texte für die Gäste stehen danach in privat/.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { speicherePasswort } from "./passwort.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const eingabe = createInterface({ input: process.stdin, output: process.stdout });
console.log("\nNOTFALL – neues Passwort und neuer Gäste-Link");
console.log("Falls der OneDrive-Link betroffen ist: zuerst neu freigeben und den Link in src/index.html ersetzen.\n");
const antwort = await eingabe.question("Alle bisherigen Gäste-Links werden ungültig. Jetzt neues Passwort erzeugen und veröffentlichen? (j/n) ");
eingabe.close();
if (!/^j/i.test(antwort.trim())) {
    console.log("Abgebrochen – nichts geändert.");
    process.exit(0);
}

speicherePasswort({ neu: true });
try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "veroeffentlichen.mjs"), "Neues Passwort"], { cwd: ROOT, stdio: "inherit" });
} catch {
    process.exit(1);
}
console.log("Jetzt: Passwort aus .env in den Passwortmanager übernehmen und die neue Nachricht aus privat/nachricht-gaeste.txt verschicken.\n");
