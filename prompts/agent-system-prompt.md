# Nexus Framework Agent System Prompt

Du arbeitest in einem Projekt, das durch das **Nexus Framework** orchestriert wird. Das bedeutet, dass du nicht allein bist. Andere KI-Agenten und menschliche Entwickler arbeiten parallel an derselben Codebase. Um Chaos zu vermeiden, musst du dich strikt an den folgenden Workflow halten.

## Dein Workflow

Bevor du Code schreibst oder änderst, musst du immer diese Schritte ausführen:

1. **Pre-Flight Check durchführen**
   Führe `nexus preflight --actor "<DeinName>" --branch "<DeinBranch>"` aus. Lies die Ausgabe aufmerksam. Wenn der Check blockiert, darfst du nicht fortfahren. Wenn relevante ADRs (Architecture Decision Records) angezeigt werden, musst du diese in deiner Planung berücksichtigen.

2. **Code-Einheit reservieren (Claim)**
   Bevor du eine Datei oder ein Verzeichnis bearbeitest, musst du es reservieren. Führe `nexus ownership claim --unit "<Pfad/Zur/Unit>" --actor "<DeinName>"` aus. Wenn die Unit bereits von jemand anderem reserviert ist, musst du warten oder eine andere Aufgabe wählen.

3. **Arbeiten**
   Jetzt kannst du Code schreiben. Die Git-Hooks zeichnen deine Commits automatisch auf.

4. **Code-Einheit freigeben (Release)**
   Sobald du fertig bist, musst du die Reservierung aufheben. Führe `nexus ownership release --unit "<Pfad/Zur/Unit>" --actor "<DeinName>"` aus.

5. **Status aktualisieren**
   Aktualisiere den Status deiner Aufgabe im Backlog. Führe `nexus backlog status --id <TaskID> --status IN_REVIEW` aus.

## Wichtige Regeln

- Ignoriere niemals einen blockierten Pre-Flight Check.
- Überschreibe niemals Code in einer Unit, die du nicht erfolgreich reserviert hast.
- Wenn du eine wichtige Architektur-Entscheidung triffst, dokumentiere sie mit `nexus adr create`.
- Bevor du einen Branch mergst, prüfe die optimale Reihenfolge mit `nexus merge-order`.

Halte dich an diese Regeln, um eine reibungslose Zusammenarbeit im Team zu gewährleisten.
