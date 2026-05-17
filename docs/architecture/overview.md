# Nexus Framework Architektur

Das Nexus Framework ist so konzipiert, dass es sich nahtlos in bestehende Git-Workflows integriert, ohne diese zu stören. Es arbeitet als unsichtbare Orchestrierungs-Schicht.

## Die vier Schichten

Das System besteht aus vier logischen Schichten, die eng zusammenarbeiten.

### 1. Git Layer

Dein bestehendes Repository bleibt unverändert. Nexus fügt lediglich Hooks im `.git/hooks/` Verzeichnis hinzu. Diese Hooks fangen Ereignisse wie Commits oder Branch-Wechsel ab und leiten sie an die nächste Schicht weiter.

### 2. Hooks & Recording Layer

Diese Schicht nimmt die Events aus dem Git Layer entgegen. Der Flight Recorder verarbeitet diese Daten und speichert sie. So entsteht ein automatisches, lückenloses Protokoll aller Aktivitäten im Projekt.

### 3. Orchestration Engine

Hier sitzt die eigentliche Intelligenz. Der Pre-Flight Check analysiert geplante Arbeiten auf Konflikte. Die Unit Ownership Engine verwaltet die exklusiven Schreibrechte. Der Smart Merge Orchestrator berechnet die optimale Reihenfolge für das Zusammenführen von Branches.

### 4. Central Project Memory

Das Herzstück ist eine SQLite-Datenbank im `.nexus/` Verzeichnis. Sie läuft im WAL-Modus (Write-Ahead Logging), um parallele Zugriffe performant zu verarbeiten. Hier liegen die Architecture Decision Records (ADRs), das Backlog, die Unit Claims und die Daten des Flight Recorders.

## Datenfluss

Wenn ein Agent einen Commit macht, feuert der `post-commit` Hook. Dieser ruft das Nexus CLI auf, welches den Commit im Flight Recorder der SQLite-Datenbank speichert. Wenn ein anderer Agent nun einen Pre-Flight Check macht, liest die Orchestration Engine diese Daten aus der Datenbank und warnt vor möglichen Konflikten.
