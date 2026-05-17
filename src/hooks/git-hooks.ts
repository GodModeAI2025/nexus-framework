/**
 * Nexus Framework - Git Hooks for Multi-Agent Multi-User SDLC
 * 
 * These hooks fire automatically at every git event and ensure:
 * 1. Flight Recorder captures WHO did WHAT on WHICH branch
 * 2. Pre-commit validates branch protection and ownership
 * 3. Post-commit notifies other agents of changes
 * 4. Pre-push runs conflict detection across all active branches
 * 5. Post-merge cleans up stale claims and flight records
 * 6. Post-checkout detects context switches between items
 * 7. Prepare-commit-msg injects item references automatically
 * 
 * Every hook is Multi-Agent aware: it reads the current actor from
 * the environment (NEXUS_ACTOR) or git config user.name.
 */

import * as fs from 'fs';
import * as path from 'path';
import { findProjectRoot } from '../db';

// ─── Hook Scripts ─────────────────────────────────────────────────────────────

const PRE_COMMIT_HOOK = `#!/bin/bash
# Nexus Framework - Pre-Commit Hook
# Multi-Agent Safety Gate: Validates branch protection, ownership, and conflicts

ACTOR="\${NEXUS_ACTOR:-\$(git config user.name 2>/dev/null || echo 'unknown')}"
BRANCH="\$(git branch --show-current 2>/dev/null || echo 'detached')"

# 1. Block commits on protected branches
PROTECTED="main master dev develop"
for p in $PROTECTED; do
  if [ "$BRANCH" = "$p" ]; then
    echo ""
    echo "  ╔══════════════════════════════════════════════════════════╗"
    echo "  ║  NEXUS BLOCKED: Direct commit on '$BRANCH' forbidden    ║"
    echo "  ╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Create a feature branch first:"
    echo "    nexus workflow branch --item <ITEM-ID>"
    echo ""
    exit 1
  fi
done

# 2. Check unit ownership for modified files
MODIFIED_FILES="\$(git diff --cached --name-only)"
if [ -n "$MODIFIED_FILES" ]; then
  for file in $MODIFIED_FILES; do
    UNIT="\$(dirname "$file")"
    if [ "$UNIT" != "." ]; then
      # Check .nexus/ownership.json for conflicts
      NEXUS_DIR="\$(git rev-parse --show-toplevel 2>/dev/null)/.nexus"
      if [ -f "$NEXUS_DIR/ownership.json" ]; then
        OWNER="\$(cat "$NEXUS_DIR/ownership.json" | grep -A1 "\\"$UNIT\\"" | grep "agent_name" | sed 's/.*: "\\(.*\\)".*/\\1/' 2>/dev/null)"
        if [ -n "$OWNER" ] && [ "$OWNER" != "$ACTOR" ]; then
          echo ""
          echo "  NEXUS BLOCKED: Unit '$UNIT' is owned by '$OWNER'."
          echo "  You ($ACTOR) cannot commit here."
          echo "  Coordinate: nexus ownership release --unit $UNIT --actor $OWNER"
          echo ""
          exit 1
        fi
      fi
    fi
  done
fi

# 3. Record pre-commit event
nexus flight-record --actor "$ACTOR" --action "pre-commit" \\
  --branch "$BRANCH" --summary "Commit validated on $BRANCH" 2>/dev/null || true

exit 0
`;

const POST_COMMIT_HOOK = `#!/bin/bash
# Nexus Framework - Post-Commit Hook
# Multi-Agent State Sync: Records commit so other agents see the change

ACTOR="\${NEXUS_ACTOR:-\$(git config user.name 2>/dev/null || echo 'unknown')}"
BRANCH="\$(git branch --show-current 2>/dev/null || echo 'detached')"
SESSION="\${NEXUS_SESSION_ID:-\$\$}"
COMMIT="\$(git rev-parse --short HEAD 2>/dev/null)"
MESSAGE="\$(git log -1 --pretty=%s 2>/dev/null)"
FILES_CHANGED="\$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null | wc -l | tr -d ' ')"

# Record in flight recorder
nexus flight-record \\
  --actor "$ACTOR" \\
  --session "$SESSION" \\
  --action "commit" \\
  --branch "$BRANCH" \\
  --summary "$COMMIT: $MESSAGE" \\
  --metadata "{\\"sha\\":\\"$COMMIT\\",\\"files_changed\\":$FILES_CHANGED}" 2>/dev/null || true

# Append to shared commit log for cross-agent visibility
NEXUS_DIR="\$(git rev-parse --show-toplevel 2>/dev/null)/.nexus"
if [ -d "$NEXUS_DIR" ]; then
  echo "$ACTOR|$BRANCH|$COMMIT|\$(date -u +%Y-%m-%dT%H:%M:%SZ)|$MESSAGE" >> "$NEXUS_DIR/commit-log.txt"
fi

exit 0
`;

const POST_CHECKOUT_HOOK = `#!/bin/bash
# Nexus Framework - Post-Checkout Hook
# Context Switch Detection: Warns if another agent is active on target branch

PREV_HEAD="$1"
NEW_HEAD="$2"
BRANCH_FLAG="$3"

# Only record branch switches (not file checkouts)
if [ "$BRANCH_FLAG" != "1" ]; then
  exit 0
fi

ACTOR="\${NEXUS_ACTOR:-\$(git config user.name 2>/dev/null || echo 'unknown')}"
BRANCH="\$(git branch --show-current 2>/dev/null || echo 'detached')"
SESSION="\${NEXUS_SESSION_ID:-\$\$}"

# Record checkout in flight recorder
nexus flight-record \\
  --actor "$ACTOR" \\
  --session "$SESSION" \\
  --action "branch-switch" \\
  --branch "$BRANCH" \\
  --summary "Switched to $BRANCH" \\
  --metadata "{\\"prev_head\\":\\"$PREV_HEAD\\",\\"new_head\\":\\"$NEW_HEAD\\"}" 2>/dev/null || true

# Check if another agent is active on this branch
NEXUS_DIR="\$(git rev-parse --show-toplevel 2>/dev/null)/.nexus"
if [ -f "$NEXUS_DIR/active-sessions.json" ]; then
  OTHER_AGENTS="\$(cat "$NEXUS_DIR/active-sessions.json" | grep -v "$ACTOR" | grep "$BRANCH" | grep "actor" | sed 's/.*: "\\(.*\\)".*/\\1/' 2>/dev/null)"
  if [ -n "$OTHER_AGENTS" ]; then
    echo ""
    echo "  ╔══════════════════════════════════════════════════════════╗"
    echo "  ║  NEXUS NOTICE: Other agent(s) active on '$BRANCH'       ║"
    echo "  ╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Active: $OTHER_AGENTS"
    echo "  Run: nexus preflight --actor $ACTOR --branch $BRANCH"
    echo ""
  fi
fi

exit 0
`;

const POST_MERGE_HOOK = `#!/bin/bash
# Nexus Framework - Post-Merge Hook
# Multi-Agent Cleanup: Releases claims and archives flight records

ACTOR="\${NEXUS_ACTOR:-\$(git config user.name 2>/dev/null || echo 'unknown')}"
BRANCH="\$(git branch --show-current 2>/dev/null || echo 'detached')"
SESSION="\${NEXUS_SESSION_ID:-\$\$}"

# Record the merge event
nexus flight-record \\
  --actor "$ACTOR" \\
  --session "$SESSION" \\
  --action "merge" \\
  --branch "$BRANCH" \\
  --summary "Merge completed into $BRANCH" 2>/dev/null || true

# If merging into a protected branch, trigger cleanup
if [ "$BRANCH" = "develop" ] || [ "$BRANCH" = "dev" ] || [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  MERGED_BRANCH="\$(git log -1 --pretty=%s | grep -oP "Merge branch '\\K[^']+")"
  if [ -n "$MERGED_BRANCH" ]; then
    nexus merge-cleanup --branch "$MERGED_BRANCH" 2>/dev/null || true
    echo "  NEXUS: Cleaned up claims and records for merged branch '$MERGED_BRANCH'"
  fi
fi

exit 0
`;

const PRE_PUSH_HOOK = `#!/bin/bash
# Nexus Framework - Pre-Push Hook
# Cross-Agent Conflict Detection before pushing to remote

ACTOR="\${NEXUS_ACTOR:-\$(git config user.name 2>/dev/null || echo 'unknown')}"
BRANCH="\$(git branch --show-current 2>/dev/null || echo 'detached')"

# Run pre-flight check (informational, non-blocking)
RESULT="\$(nexus preflight --actor "$ACTOR" --branch "$BRANCH" --quiet 2>&1)"
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ] && [ -n "$RESULT" ]; then
  echo ""
  echo "  ╔══════════════════════════════════════════════════════════╗"
  echo "  ║  NEXUS WARNING: Potential conflicts detected            ║"
  echo "  ╚══════════════════════════════════════════════════════════╝"
  echo ""
  echo "  $RESULT"
  echo ""
  echo "  Push continues. Run 'nexus preflight --actor $ACTOR' for details."
  echo ""
fi

# Record push event
nexus flight-record --actor "$ACTOR" --action "push" \\
  --branch "$BRANCH" --summary "Push to remote" 2>/dev/null || true

exit 0
`;

const PREPARE_COMMIT_MSG_HOOK = `#!/bin/bash
# Nexus Framework - Prepare-Commit-Msg Hook
# Auto-injects "Refs: <ITEM-ID>" based on branch naming convention

COMMIT_MSG_FILE="$1"
COMMIT_SOURCE="$2"

# Only inject on regular commits (not merge, squash, amend)
if [ -n "$COMMIT_SOURCE" ]; then
  exit 0
fi

BRANCH="\$(git branch --show-current 2>/dev/null || echo 'detached')"

# Extract item ID from branch name
ITEM_ID=""
case "$BRANCH" in
  feature/feat-*)
    ITEM_ID="\$(echo "$BRANCH" | sed 's|feature/||' | grep -oE 'feat-[0-9]+-[0-9]+' | tr '[:lower:]' '[:upper:]')"
    ;;
  feature/epic-*)
    ITEM_ID="\$(echo "$BRANCH" | sed 's|feature/||' | grep -oE 'epic-[0-9]+' | tr '[:lower:]' '[:upper:]')"
    ;;
  fix/fix-*)
    ITEM_ID="\$(echo "$BRANCH" | sed 's|fix/||' | grep -oE 'fix-[0-9]+-[0-9]+-[0-9]+' | tr '[:lower:]' '[:upper:]')"
    ;;
  chore/imp-*)
    ITEM_ID="\$(echo "$BRANCH" | sed 's|chore/||' | grep -oE 'imp-[0-9]+-[0-9]+-[0-9]+' | tr '[:lower:]' '[:upper:]')"
    ;;
esac

# Append Refs line if item ID found and not already present
if [ -n "$ITEM_ID" ]; then
  if ! grep -q "Refs:" "$COMMIT_MSG_FILE" 2>/dev/null; then
    echo "" >> "$COMMIT_MSG_FILE"
    echo "Refs: $ITEM_ID" >> "$COMMIT_MSG_FILE"
  fi
fi

exit 0
`;

// ─── Hook Registry ────────────────────────────────────────────────────────────

const HOOKS: Record<string, string> = {
  'pre-commit': PRE_COMMIT_HOOK,
  'post-commit': POST_COMMIT_HOOK,
  'post-checkout': POST_CHECKOUT_HOOK,
  'post-merge': POST_MERGE_HOOK,
  'pre-push': PRE_PUSH_HOOK,
  'prepare-commit-msg': PREPARE_COMMIT_MSG_HOOK,
};

// ─── Installation ─────────────────────────────────────────────────────────────

export function installHooks(projectRoot?: string): string[] {
  const root = projectRoot || findProjectRoot();
  const gitDir = path.join(root, '.git');

  if (!fs.existsSync(gitDir)) {
    throw new Error(`No .git directory found in ${root}. Initialize a git repo first.`);
  }

  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const installed: string[] = [];

  for (const [hookName, hookContent] of Object.entries(HOOKS)) {
    const hookPath = path.join(hooksDir, hookName);

    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, 'utf-8');
      if (existing.includes('Nexus Framework')) {
        continue; // Already installed
      }
      fs.appendFileSync(hookPath, '\n\n# --- Nexus Framework Hook ---\n' + hookContent.replace('#!/bin/bash\n', ''));
    } else {
      fs.writeFileSync(hookPath, hookContent);
    }

    fs.chmodSync(hookPath, '755');
    installed.push(hookName);
  }

  return installed;
}

export function uninstallHooks(projectRoot?: string): string[] {
  const root = projectRoot || findProjectRoot();
  const hooksDir = path.join(root, '.git', 'hooks');
  const removed: string[] = [];

  for (const hookName of Object.keys(HOOKS)) {
    const hookPath = path.join(hooksDir, hookName);
    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf-8');
      if (content.includes('Nexus Framework')) {
        if (content.startsWith('#!/bin/bash\n# Nexus Framework')) {
          fs.unlinkSync(hookPath);
        } else {
          const cleaned = content.replace(/\n\n# --- Nexus Framework Hook ---\n[\s\S]*$/, '');
          fs.writeFileSync(hookPath, cleaned);
        }
        removed.push(hookName);
      }
    }
  }

  return removed;
}

// ─── Session Management (Multi-Agent Core) ────────────────────────────────────

export interface ActiveSession {
  actor: string;
  type: 'agent' | 'human';
  branch: string;
  itemId?: string;
  startedAt: string;
  lastActivity: string;
}

/**
 * Registers the current agent/user session in .nexus/active-sessions.json.
 * Other agents read this to know who is working where.
 */
export function registerSession(actor: string, branch: string, itemId?: string, actorType?: 'agent' | 'human'): void {
  const root = findProjectRoot();
  const nexusDir = path.join(root, '.nexus');
  if (!fs.existsSync(nexusDir)) return;

  const sessionsFile = path.join(nexusDir, 'active-sessions.json');
  let sessions: ActiveSession[] = [];

  if (fs.existsSync(sessionsFile)) {
    try { sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8')); } catch { sessions = []; }
  }

  // Remove stale session for this actor
  sessions = sessions.filter(s => s.actor !== actor);

  sessions.push({
    actor,
    type: actorType || 'agent',
    branch,
    itemId,
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  });

  fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
}

/**
 * Gets all active sessions (other agents currently working).
 */
export function getActiveSessions(excludeActor?: string): ActiveSession[] {
  const root = findProjectRoot();
  const sessionsFile = path.join(root, '.nexus', 'active-sessions.json');
  if (!fs.existsSync(sessionsFile)) return [];

  try {
    let sessions: ActiveSession[] = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    if (excludeActor) sessions = sessions.filter(s => s.actor !== excludeActor);

    // Filter out stale sessions (older than 2 hours)
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    sessions = sessions.filter(s => s.lastActivity > cutoff);

    return sessions;
  } catch { return []; }
}

/**
 * Deregisters a session when an agent finishes work.
 */
export function deregisterSession(actor: string): void {
  const root = findProjectRoot();
  const sessionsFile = path.join(root, '.nexus', 'active-sessions.json');
  if (!fs.existsSync(sessionsFile)) return;

  try {
    let sessions: ActiveSession[] = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
    sessions = sessions.filter(s => s.actor !== actor);
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
  } catch { /* ignore */ }
}
