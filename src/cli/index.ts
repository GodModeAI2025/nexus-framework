/**
 * Nexus Framework - CLI Entry Point
 * All commands for the nexus CLI tool.
 */

import { Command } from 'commander';
import { initNexus, getDatabase } from '../db';
import { createADR, listADRs, updateADRStatus } from '../db';
import { createBacklogItem, listBacklog, updateBacklogStatus, claimBacklogItem, getBacklogItem } from '../db';
import { flightRecorder, installHooks, uninstallHooks } from '../hooks';
import { runPreFlight } from '../preflight';
import { claim, release, listAllClaims } from '../ownership';
import { analyzeMergeOrder, mergeCleanup } from '../merge';

const program = new Command();

program
  .name('nexus')
  .description('Nexus Framework - Multi-Agent Multi-User Orchestration')
  .version('1.0.0');

// ============================================================
// INIT
// ============================================================
program
  .command('init')
  .description('Initialize Nexus in the current project')
  .option('--install-hooks', 'Also install git hooks')
  .action((opts) => {
    const nexusDir = initNexus();
    console.log(`✅ Nexus initialized at ${nexusDir}`);

    if (opts.installHooks) {
      try {
        const hooks = installHooks();
        console.log(`✅ Git hooks installed: ${hooks.join(', ')}`);
      } catch (e: any) {
        console.log(`⚠️  Could not install hooks: ${e.message}`);
      }
    }
  });

// ============================================================
// HOOKS
// ============================================================
const hooksCmd = program.command('hooks').description('Manage git hooks');

hooksCmd
  .command('install')
  .description('Install Nexus git hooks')
  .action(() => {
    const hooks = installHooks();
    if (hooks.length > 0) {
      console.log(`✅ Installed hooks: ${hooks.join(', ')}`);
    } else {
      console.log('ℹ️  All hooks already installed.');
    }
  });

hooksCmd
  .command('uninstall')
  .description('Remove Nexus git hooks')
  .action(() => {
    const hooks = uninstallHooks();
    if (hooks.length > 0) {
      console.log(`✅ Removed hooks: ${hooks.join(', ')}`);
    } else {
      console.log('ℹ️  No Nexus hooks found.');
    }
  });

// ============================================================
// FLIGHT RECORDER
// ============================================================
program
  .command('flight-record')
  .description('Record an event in the flight recorder')
  .requiredOption('--actor <name>', 'Actor name (agent or user)')
  .requiredOption('--action <action>', 'Action type (commit, branch-switch, plan, etc.)')
  .option('--session <id>', 'Session ID')
  .option('--branch <branch>', 'Branch name')
  .option('--item <id>', 'Backlog item ID')
  .option('--summary <text>', 'Summary of the action')
  .option('--metadata <json>', 'JSON metadata')
  .action((opts) => {
    const id = flightRecorder.record({
      actor_name: opts.actor,
      session_id: opts.session,
      action: opts.action,
      branch: opts.branch,
      item_id: opts.item,
      summary: opts.summary,
      metadata: opts.metadata ? JSON.parse(opts.metadata) : undefined,
    });
    console.log(`✅ Flight record #${id} created`);
  });

program
  .command('flight-log')
  .description('Show the flight recorder log')
  .option('--branch <branch>', 'Filter by branch')
  .option('--actor <name>', 'Filter by actor')
  .option('--limit <n>', 'Limit results', '20')
  .action((opts) => {
    const records = flightRecorder.getRecords({
      branch: opts.branch,
      actor_name: opts.actor,
      limit: parseInt(opts.limit),
    });

    if (records.length === 0) {
      console.log('ℹ️  No flight records found.');
      return;
    }

    console.log('📋 Flight Recorder Log:');
    console.log('─'.repeat(80));
    for (const r of records) {
      console.log(`  [${r.timestamp}] ${r.actor_name} → ${r.action} on ${r.branch || '(no branch)'}`);
      if (r.summary) console.log(`    ${r.summary}`);
    }
  });

program
  .command('active-work')
  .description('Show all active parallel work')
  .action(() => {
    const active = flightRecorder.getActive();
    if (active.length === 0) {
      console.log('ℹ️  No active work detected.');
      return;
    }

    console.log('🔄 Active Parallel Work:');
    console.log('─'.repeat(80));
    for (const w of active) {
      console.log(`  Branch: ${w.branch || '?'} | Actor: ${w.actor_name} | Last: ${w.timestamp}`);
      if (w.summary) console.log(`    ${w.summary}`);
    }
  });

// ============================================================
// PRE-FLIGHT CHECK
// ============================================================
program
  .command('preflight')
  .description('Run pre-flight check before starting work')
  .requiredOption('--actor <name>', 'Your actor name')
  .option('--branch <branch>', 'Target branch')
  .option('--quiet', 'Only output if conflicts found')
  .action((opts) => {
    const result = runPreFlight(opts.actor, {
      branch: opts.branch,
      quiet: opts.quiet,
    });

    if (opts.quiet && result.recommendation === 'proceed') {
      return;
    }

    console.log(result.summary);

    if (result.relevantADRs.length > 0) {
      console.log('\n📚 Relevant ADRs:');
      for (const adr of result.relevantADRs) {
        console.log(`  ${adr.id}: ${adr.title}`);
      }
    }
  });

// ============================================================
// UNIT OWNERSHIP
// ============================================================
const ownershipCmd = program.command('ownership').description('Manage unit ownership');

ownershipCmd
  .command('claim')
  .description('Claim a unit for exclusive access')
  .requiredOption('--unit <key>', 'Unit key (e.g., src/renderer)')
  .requiredOption('--actor <name>', 'Actor name')
  .action((opts) => {
    const result = claim(opts.unit, opts.actor);
    console.log(result.message);
    if (!result.success) process.exit(1);
  });

ownershipCmd
  .command('release')
  .description('Release a claimed unit')
  .requiredOption('--unit <key>', 'Unit key')
  .requiredOption('--actor <name>', 'Actor name')
  .action((opts) => {
    const result = release(opts.unit, opts.actor);
    console.log(result.message);
    if (!result.success) process.exit(1);
  });

ownershipCmd
  .command('list')
  .description('List all current claims')
  .option('--actor <name>', 'Filter by actor')
  .action((opts) => {
    const claims = listAllClaims(opts.actor);
    if (claims.length === 0) {
      console.log('ℹ️  No active claims.');
      return;
    }
    console.log('🔒 Active Unit Claims:');
    console.log('─'.repeat(60));
    for (const c of claims) {
      console.log(`  ${c.unit_key} → ${c.agent_name} (since ${c.claimed_at})`);
    }
  });

// ============================================================
// SMART MERGE
// ============================================================
program
  .command('merge-order')
  .description('Analyze branches and recommend merge order')
  .action(() => {
    const result = analyzeMergeOrder();
    for (const rec of result.recommendations) {
      console.log(rec);
    }
  });

program
  .command('merge-cleanup')
  .description('Clean up flight records after a branch merge')
  .requiredOption('--branch <branch>', 'The merged branch name')
  .action((opts) => {
    const result = mergeCleanup(opts.branch);
    console.log(result.message);
  });

// ============================================================
// ADR Management
// ============================================================
const adrCmd = program.command('adr').description('Manage Architecture Decision Records');

adrCmd
  .command('create')
  .description('Create a new ADR')
  .requiredOption('--id <id>', 'ADR ID (e.g., ADR-001)')
  .requiredOption('--title <title>', 'ADR title')
  .option('--context <text>', 'Context/problem statement')
  .option('--decision <text>', 'The decision made')
  .option('--consequences <text>', 'Consequences of the decision')
  .option('--actor <name>', 'Who created this ADR')
  .action((opts) => {
    const db = getDatabase();
    try {
      createADR(db, {
        id: opts.id,
        title: opts.title,
        status: 'proposed',
        context: opts.context,
        decision: opts.decision,
        consequences: opts.consequences,
        created_by: opts.actor,
      });
      console.log(`✅ ADR ${opts.id} created: "${opts.title}"`);
    } finally {
      db.close();
    }
  });

adrCmd
  .command('list')
  .description('List all ADRs')
  .option('--status <status>', 'Filter by status')
  .action((opts) => {
    const db = getDatabase();
    try {
      const adrs = listADRs(db, opts.status);
      if (adrs.length === 0) {
        console.log('ℹ️  No ADRs found.');
        return;
      }
      console.log('📋 Architecture Decision Records:');
      console.log('─'.repeat(80));
      for (const adr of adrs) {
        console.log(`  [${adr.status.toUpperCase()}] ${adr.id}: ${adr.title}`);
        if (adr.decision) console.log(`    Decision: ${adr.decision}`);
      }
    } finally {
      db.close();
    }
  });

adrCmd
  .command('accept')
  .description('Accept a proposed ADR')
  .requiredOption('--id <id>', 'ADR ID')
  .action((opts) => {
    const db = getDatabase();
    try {
      updateADRStatus(db, opts.id, 'accepted');
      console.log(`✅ ADR ${opts.id} accepted.`);
    } finally {
      db.close();
    }
  });

// ============================================================
// BACKLOG
// ============================================================
const backlogCmd = program.command('backlog').description('Manage the project backlog');

backlogCmd
  .command('add')
  .description('Add a new backlog item')
  .requiredOption('--id <id>', 'Item ID (e.g., FEAT-01)')
  .requiredOption('--title <title>', 'Item title')
  .requiredOption('--type <type>', 'Type: FEAT, FIX, IMP, EPIC')
  .option('--priority <p>', 'Priority: P0, P1, P2', 'P1')
  .action((opts) => {
    const db = getDatabase();
    try {
      createBacklogItem(db, {
        item_id: opts.id,
        title: opts.title,
        type: opts.type.toUpperCase(),
        status: 'NEW',
        priority: opts.priority.toUpperCase(),
      });
      console.log(`✅ Backlog item ${opts.id} created: "${opts.title}"`);
    } finally {
      db.close();
    }
  });

backlogCmd
  .command('list')
  .description('List backlog items')
  .option('--status <status>', 'Filter by status')
  .action((opts) => {
    const db = getDatabase();
    try {
      const items = listBacklog(db, opts.status);
      if (items.length === 0) {
        console.log('ℹ️  No backlog items found.');
        return;
      }
      console.log('📋 Backlog:');
      console.log('─'.repeat(80));
      for (const item of items) {
        const claim = item.claimed_by ? ` [${item.claimed_by}]` : '';
        console.log(`  [${item.priority}] ${item.item_id}: ${item.title} (${item.status})${claim}`);
      }
    } finally {
      db.close();
    }
  });

backlogCmd
  .command('claim')
  .description('Claim a backlog item')
  .requiredOption('--id <id>', 'Item ID')
  .requiredOption('--actor <name>', 'Actor name')
  .action((opts) => {
    const db = getDatabase();
    try {
      claimBacklogItem(db, opts.id, opts.actor);
      console.log(`✅ ${opts.actor} claimed ${opts.id}`);
    } finally {
      db.close();
    }
  });

backlogCmd
  .command('status')
  .description('Update backlog item status')
  .requiredOption('--id <id>', 'Item ID')
  .requiredOption('--status <status>', 'New status: NEW, READY, IN_PROGRESS, IN_REVIEW, DONE')
  .action((opts) => {
    const db = getDatabase();
    try {
      updateBacklogStatus(db, opts.id, opts.status.toUpperCase());
      console.log(`✅ ${opts.id} status updated to ${opts.status.toUpperCase()}`);
    } finally {
      db.close();
    }
  });

// ============================================================
// STATUS (overview)
// ============================================================
program
  .command('status')
  .description('Show full Nexus project status')
  .action(() => {
    const db = getDatabase();
    try {
      const activeWork = flightRecorder.getActive();
      const claims = listAllClaims();
      const adrs = listADRs(db, 'accepted');
      const backlog = listBacklog(db, 'IN_PROGRESS');

      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║              NEXUS PROJECT STATUS                           ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`  🔄 Active Work:     ${activeWork.length} branch(es)`);
      console.log(`  🔒 Unit Claims:     ${claims.length} active`);
      console.log(`  📚 Accepted ADRs:   ${adrs.length}`);
      console.log(`  📋 In Progress:     ${backlog.length} item(s)`);
      console.log('');

      if (activeWork.length > 0) {
        console.log('  Active Branches:');
        for (const w of activeWork) {
          console.log(`    • ${w.branch} (${w.actor_name})`);
        }
      }
    } finally {
      db.close();
    }
  });

export { program };
