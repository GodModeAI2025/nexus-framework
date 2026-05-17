# Integration mit Claude Code

Claude Code ist ein hervorragender Agent für die Arbeit im Terminal. Damit Claude das Nexus Framework optimal nutzt, musst du ihm den richtigen Kontext mitgeben.

## Schritt 1: Nexus initialisieren

Stelle sicher, dass Nexus in deinem Projekt initialisiert ist. Führe dazu `nexus init --install-hooks` im Projekt-Root aus.

## Schritt 2: System-Prompt konfigurieren

Claude Code erlaubt es, projekt-spezifische Instruktionen über eine `.clauderc` oder ähnliche Konfigurationsdateien mitzugeben. Kopiere den Inhalt aus `prompts/agent-system-prompt.md` und füge ihn in die Instruktionen für Claude ein.

## Schritt 3: Umgebungsvariablen setzen

Bevor du Claude Code startest, setze die Identität. Das ist wichtig, damit der Flugrekorder weiß, wer die Aktionen ausführt.

```bash
export NEXUS_ACTOR_NAME="Claude"
```

## Schritt 4: Claude starten

Starte Claude Code wie gewohnt. Durch den System-Prompt weiß Claude nun, dass er vor jeder Aktion den Pre-Flight Check ausführen und Units claimen muss.

## Tipps für die Zusammenarbeit

Wenn du Claude bittest, ein neues Feature zu implementieren, weise ihn explizit darauf hin, das Backlog zu prüfen. Sag ihm zum Beispiel: "Schau im Backlog nach dem nächsten P0-Feature, claime es und setze es um." Claude wird dann selbstständig die Nexus-Befehle nutzen, um die Arbeit zu koordinieren.
