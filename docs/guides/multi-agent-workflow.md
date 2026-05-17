# Nexus Framework: Multi-Agent Multi-User Workflow Guide

Das Nexus Framework löst das zentrale Problem der modernen Softwareentwicklung mit KI: **Koordination**. Wenn mehrere menschliche Entwickler und mehrere autonome KI-Agenten gleichzeitig an derselben Codebase arbeiten, entstehen ohne strikte Regeln Chaos, Merge-Konflikte und überschriebene Arbeit. Nexus ist die Lösung für dieses "Multi-Agent Multi-User" Problem.

## Was ist das Nexus Framework?

Nexus ist ein CLI-basiertes Orchestrierungs-Framework, das sich nahtlos in Git integriert. Es kombiniert die besten Konzepte aus bewährten Systemen (wie DIA und GSD) und fügt eine entscheidende Schicht hinzu: **Cross-Agent Awareness**.

Es ist kein Ersatz für Git, sondern ein intelligenter Wrapper, der sicherstellt, dass Agenten und Menschen wissen, was die anderen tun, *bevor* sie Code ändern.

## Was bringt es? (Der Nutzen)

1. **Keine überschriebene Arbeit:** Durch die *Single-Writer Guarantee* (Unit Ownership) kann immer nur ein Agent/Mensch an einer spezifischen Komponente arbeiten.
2. **Keine blinden Agenten:** Der *Pre-Flight Check* zwingt Agenten, vor Arbeitsbeginn zu prüfen, ob ihre geplanten Änderungen mit der Arbeit anderer kollidieren.
3. **Kein Architektur-Chaos:** *Architecture Decision Records (ADRs)* sind global bindend. Der Build-Context-Scanner prüft, ob Agenten diese Regeln einhalten.
4. **Keine Merge-Hölle:** Der *Smart Merge Orchestrator* analysiert Abhängigkeiten zwischen fertigen Branches und empfiehlt die exakte Reihenfolge für konfliktfreie Merges.
5. **Vollständige Transparenz:** Der *Flugrekorder* (Flight-Log) zeichnet jede Aktion auf. Jeder weiß, wer wann was warum getan hat.

## Wo hilft es? (Einsatzszenarien)

- **Szenario A: Mensch + Agent.** Du entwickelst das Frontend, während Claude Code im Hintergrund das Backend-API schreibt. Nexus verhindert, dass Claude deine API-Contracts überschreibt.
- **Szenario B: Agent + Agent.** Du gibst zwei Agenten (z.B. Codex und Gemini) parallel Aufgaben. Nexus sorgt dafür, dass sie sich nicht gegenseitig die Datenbank-Schema-Dateien zerschießen.
- **Szenario C: Das ganze Team.** Ein Team aus 5 Entwicklern und 10 Agenten arbeitet an einem Monolithen. Nexus orchestriert den gesamten SDLC (Software Development Life Cycle) über das V-Model.

---

## Praxis-Guide: Wie man es mit mehreren Leuten und Agenten benutzt

Hier ist der exakte Workflow, wie ein Multi-Agent Multi-User Team mit Nexus arbeitet.

### 1. Initialisierung (Einmalig pro Projekt)

Ein menschlicher Entwickler initialisiert das Projekt:
```bash
nexus init --install-hooks
```
*Was passiert:* Die SQLite-Datenbank (`.nexus/nexus.db`) wird erstellt und die Git-Hooks werden installiert. Ab jetzt wird jede Git-Aktion automatisch im Flugrekorder protokolliert.

### 2. Session Start (Mensch & Agent)

Jeder Akteur (Mensch oder Agent) muss sich anmelden, wenn er zu arbeiten beginnt.

**Mensch:**
```bash
nexus session start --actor "Alice" --type "human"
```

**Agent (z.B. Claude):**
```bash
nexus session start --actor "Claude-Backend" --type "agent"
```
*Warum:* So sehen alle, wer gerade aktiv im Repository unterwegs ist (`nexus session list`).

### 3. Der Pre-Flight Check (Das Wichtigste!)

Bevor ein Agent (oder Mensch) anfängt, Code zu schreiben, **muss** er den Pre-Flight Check ausführen. Er teilt dem System mit, was er vorhat.

```bash
nexus preflight --actor "Claude-Backend" --intent "Implementiere User-Auth API in src/api/auth.ts"
```
*Was passiert:* Nexus scannt die aktiven Sessions, die geclaimten Units und das Backlog. Es warnt den Agenten: *"Achtung, Bob arbeitet gerade an der Datenbank-Verbindung, die du für Auth brauchst. Warte, bis er fertig ist, oder sprich dich ab."*

### 4. Unit Ownership (Single-Writer Guarantee)

Wenn der Pre-Flight Check grün ist, "claimt" der Agent die Dateien/Komponenten, die er bearbeiten wird.

```bash
nexus ownership claim --unit "src/api/auth.ts" --actor "Claude-Backend"
```
*Was passiert:* Die Datei ist jetzt für Claude gesperrt. Wenn ein anderer Agent versucht, diese Datei zu ändern, blockieren die Git-Hooks den Commit.

### 5. Arbeiten und Workflow-Phasen

Der Agent arbeitet nun ganz normal mit Git. Nexus trackt den Fortschritt über das V-Model.

```bash
# Agent erstellt den Branch
nexus workflow branch --item "AUTH-123"

# Agent markiert die Design-Phase als fertig
nexus workflow phase-done --phase "DESIGN" --actor "Claude-Backend"
```
*Was passiert:* State-Machine Guards prüfen, ob der Agent Phasen überspringt (z.B. von NEW direkt auf DONE, ohne REVIEW).

### 6. Der Build-Context (Vor dem Merge)

Wenn der Agent fertig ist, erstellt er einen Pull Request. Bevor die CI/CD-Pipeline (oder der Release-Agent) baut, wird der Kontext geprüft:

```bash
nexus build-context
```
*Was passiert:* Nexus listet alle globalen Architektur-Regeln (ADRs) auf, die der Code einhalten muss, und zeigt, ob andere fertige Branches existieren, die zuerst gemerged werden sollten.

### 7. Smart Merge und Cleanup

Der Release-Manager (Mensch oder Agent) nutzt Nexus, um die Merge-Reihenfolge zu bestimmen:

```bash
nexus merge-order
```
Nach dem erfolgreichen Merge räumt der Agent auf:
```bash
nexus ownership release --unit "src/api/auth.ts" --actor "Claude-Backend"
nexus merge-cleanup --branch "feature/AUTH-123"
```

---

## Wie Agenten Nexus automatisch nutzen

Damit Agenten (wie Claude Code, Cursor, Codex) Nexus nutzen, ohne dass du ihnen jeden Befehl einzeln geben musst, enthält das Framework **Agent-System-Prompts**.

Du fügst einfach den Inhalt von `prompts/agent-system-prompt.md` in die Custom Instructions deines Agenten ein. Dieser Prompt instruiert den Agenten:
1. Immer `nexus session start` auszuführen.
2. Vor jedem Task `nexus preflight` zu machen.
3. Dateien mit `nexus ownership claim` zu sperren.
4. Den Flugrekorder zu lesen, wenn er Kontext braucht.

So wird aus einem "blinden" Agenten ein teamfähiger Nexus-Agent.
