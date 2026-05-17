/**
 * Nexus Framework - Git Hook Templates & Installer
 * Installs hooks that feed the flight recorder automatically.
 */

import * as fs from 'fs';
import * as path from 'path';
import { findProjectRoot } from '../db';

const POST_COMMIT_HOOK = `#!/bin/bash
# Nexus Framework - Post-Commit Hook
# Records every commit in the flight recorder

BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
ACTOR=\${NEXUS_ACTOR_NAME:-$(git config user.name 2>/dev/null || echo "unknown")}
SESSION=\${NEXUS_SESSION_ID:-$$}
COMMIT=$(git rev-parse HEAD 2>/dev/null)
MESSAGE=$(git log -1 --pretty=%s 2>/dev/null)
FILES_CHANGED=$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null | wc -l | tr -d ' ')

nexus flight-record \\
  --actor "$ACTOR" \\
  --session "$SESSION" \\
  --action "commit" \\
  --branch "$BRANCH" \\
  --summary "$MESSAGE" \\
  --metadata "{\\"commit\\":\\"$COMMIT\\",\\"files_changed\\":$FILES_CHANGED}" 2>/dev/null || true
`;

const POST_CHECKOUT_HOOK = `#!/bin/bash
# Nexus Framework - Post-Checkout Hook
# Records branch switches in the flight recorder

PREV_HEAD=$1
NEW_HEAD=$2
BRANCH_FLAG=$3

# Only record branch switches (not file checkouts)
if [ "$BRANCH_FLAG" = "1" ]; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
  ACTOR=\${NEXUS_ACTOR_NAME:-$(git config user.name 2>/dev/null || echo "unknown")}
  SESSION=\${NEXUS_SESSION_ID:-$$}

  nexus flight-record \\
    --actor "$ACTOR" \\
    --session "$SESSION" \\
    --action "branch-switch" \\
    --branch "$BRANCH" \\
    --summary "Switched to branch $BRANCH" \\
    --metadata "{\\"prev_head\\":\\"$PREV_HEAD\\",\\"new_head\\":\\"$NEW_HEAD\\"}" 2>/dev/null || true
fi
`;

const POST_MERGE_HOOK = `#!/bin/bash
# Nexus Framework - Post-Merge Hook
# Triggers cleanup of the flight recorder for merged branches

BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
ACTOR=\${NEXUS_ACTOR_NAME:-$(git config user.name 2>/dev/null || echo "unknown")}
SESSION=\${NEXUS_SESSION_ID:-$$}

# Record the merge event
nexus flight-record \\
  --actor "$ACTOR" \\
  --session "$SESSION" \\
  --action "merge" \\
  --branch "$BRANCH" \\
  --summary "Merge completed into $BRANCH" 2>/dev/null || true

# If merging into develop/main, trigger cleanup
if [ "$BRANCH" = "develop" ] || [ "$BRANCH" = "dev" ] || [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  # Get the merged branch name from the merge commit message
  MERGED_BRANCH=$(git log -1 --pretty=%s | grep -oP "Merge branch '\\K[^']+")
  if [ -n "$MERGED_BRANCH" ]; then
    nexus merge-cleanup --branch "$MERGED_BRANCH" 2>/dev/null || true
  fi
fi
`;

const PRE_PUSH_HOOK = `#!/bin/bash
# Nexus Framework - Pre-Push Hook
# Runs pre-flight check before pushing

BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
ACTOR=\${NEXUS_ACTOR_NAME:-$(git config user.name 2>/dev/null || echo "unknown")}

# Run pre-flight check (non-blocking, just informational)
nexus preflight --actor "$ACTOR" --branch "$BRANCH" --quiet 2>/dev/null || true
`;

const HOOKS: Record<string, string> = {
  'post-commit': POST_COMMIT_HOOK,
  'post-checkout': POST_CHECKOUT_HOOK,
  'post-merge': POST_MERGE_HOOK,
  'pre-push': PRE_PUSH_HOOK,
};

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

    // If hook already exists, append nexus section
    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, 'utf-8');
      if (existing.includes('Nexus Framework')) {
        continue; // Already installed
      }
      // Append to existing hook
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
        // If it's purely our hook, remove the file
        if (content.startsWith('#!/bin/bash\n# Nexus Framework')) {
          fs.unlinkSync(hookPath);
        } else {
          // Remove our section from a shared hook
          const cleaned = content.replace(/\n\n# --- Nexus Framework Hook ---\n[\s\S]*$/, '');
          fs.writeFileSync(hookPath, cleaned);
        }
        removed.push(hookName);
      }
    }
  }

  return removed;
}
