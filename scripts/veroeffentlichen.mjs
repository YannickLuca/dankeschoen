// Baut die Seite neu, committet index.html (und .staticrypt.json) und pusht zu GitHub.
// Die lokalen Git-Hooks prüfen dabei nochmals, dass nichts Privates mitkommt.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, stdio: "inherit" });

    git("add", "index.html", ".staticrypt.json");
    if (!git("diff", "--cached", "--name-only")) {
        console.log("Keine Änderungen an der Seite – nichts zu veröffentlichen.");
        process.exit(0);
    }
    git("commit", "-q", "-m", process.argv[2] || "Seite aktualisiert");
    execFileSync("git", ["push", "-q", "origin", "main"], { cwd: ROOT, stdio: "inherit" });

    console.log("\n✓ Veröffentlicht. GitHub Pages ist in 1–2 Minuten aktuell – danach prüfen mit «npm test».\n");
} catch {
    console.error("\n✗ Veröffentlichen abgebrochen (siehe Meldung oben). Es wurde nichts gepusht.\n");
    process.exit(1);
}
