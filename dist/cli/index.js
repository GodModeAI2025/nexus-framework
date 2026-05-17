"use strict";
/**
 * Nexus Framework - CLI Entry Point
 * Complete Multi-Agent Multi-User SDLC Orchestration CLI.
 *
 * Commands:
 * - init: Initialize Nexus in a project
 * - hooks: Install/uninstall git hooks
 * - preflight: Cross-agent conflict detection
 * - ownership: Unit ownership (claim/release/list)
 * - flight-record / flight-log / active-work: Flight recorder
 * - merge-order / merge-cleanup: Smart merge orchestrator
 * - adr: Architecture Decision Records
 * - backlog: Backlog management
 * - workflow: V-Model workflow (branch, phase-done, status)
 * - build-context: Cross-branch PR & ADR awareness
 * - skills: Skill discovery and phase routing
 * - session: Multi-agent session management
 * - status: Full project overview
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.program = void 0;
const commander_1 = require("commander");
const db_1 = require("../db");
const db_2 = require("../db");
const db_3 = require("../db");
const hooks_1 = require("../hooks");
const preflight_1 = require("../preflight");
const ownership_1 = require("../ownership");
const merge_1 = require("../merge");
const build_1 = require("../build");
const skills_1 = require("../skills");
const v_model_1 = require("../workflow/v-model");
const branch_naming_1 = require("../workflow/branch-naming");
const context_budget_1 = require("../workflow/context-budget");
const program = new commander_1.Command();
exports.program = program;
program
    .name('nexus')
    .description('Nexus Framework - Multi-Agent Multi-User SDLC Orchestration')
    .version('2.0.0');
// ============================================================
// INIT
// ============================================================
program
    .command('init')
    .description('Initialize Nexus in the current project')
    .option('--install-hooks', 'Also install git hooks')
    .action((opts) => {
    const nexusDir = (0, db_1.initNexus)();
    console.log(`✅ Nexus initialized at ${nexusDir}`);
    if (opts.installHooks) {
        try {
            const hooks = (0, hooks_1.installHooks)();
            console.log(`✅ Git hooks installed: ${hooks.join(', ')}`);
        }
        catch (e) {
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
    .description('Install Nexus git hooks (pre-commit, post-commit, post-checkout, post-merge, pre-push, prepare-commit-msg)')
    .action(() => {
    const hooks = (0, hooks_1.installHooks)();
    if (hooks.length > 0) {
        console.log(`✅ Installed hooks: ${hooks.join(', ')}`);
    }
    else {
        console.log('ℹ️  All hooks already installed.');
    }
});
hooksCmd
    .command('uninstall')
    .description('Remove Nexus git hooks')
    .action(() => {
    const hooks = (0, hooks_1.uninstallHooks)();
    if (hooks.length > 0) {
        console.log(`✅ Removed hooks: ${hooks.join(', ')}`);
    }
    else {
        console.log('ℹ️  No Nexus hooks found.');
    }
});
// ============================================================
// SESSION (Multi-Agent Core)
// ============================================================
const sessionCmd = program.command('session').description('Manage agent/user sessions');
sessionCmd
    .command('start')
    .description('Register your session (tells other agents you are active)')
    .requiredOption('--actor <name>', 'Your actor name')
    .requiredOption('--branch <branch>', 'Branch you are working on')
    .option('--item <id>', 'Backlog item ID')
    .option('--type <type>', 'Actor type: agent or human', 'agent')
    .action((opts) => {
    (0, hooks_1.registerSession)(opts.actor, opts.branch, opts.item, opts.type);
    console.log(`✅ Session registered: ${opts.actor} on ${opts.branch}`);
});
sessionCmd
    .command('end')
    .description('Deregister your session')
    .requiredOption('--actor <name>', 'Your actor name')
    .action((opts) => {
    (0, hooks_1.deregisterSession)(opts.actor);
    console.log(`✅ Session ended for ${opts.actor}`);
});
sessionCmd
    .command('list')
    .description('List all active sessions')
    .option('--exclude <actor>', 'Exclude this actor from the list')
    .action((opts) => {
    const sessions = (0, hooks_1.getActiveSessions)(opts.exclude);
    if (sessions.length === 0) {
        console.log('ℹ️  No active sessions.');
        return;
    }
    console.log('🔄 Active Sessions:');
    console.log('─'.repeat(60));
    for (const s of sessions) {
        console.log(`  ${s.actor} (${s.type}) on ${s.branch}${s.itemId ? ` [${s.itemId}]` : ''}`);
        console.log(`    Last activity: ${s.lastActivity}`);
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
    const id = hooks_1.flightRecorder.record({
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
    const records = hooks_1.flightRecorder.getRecords({
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
        if (r.summary)
            console.log(`    ${r.summary}`);
    }
});
program
    .command('active-work')
    .description('Show all active parallel work')
    .action(() => {
    const active = hooks_1.flightRecorder.getActive();
    if (active.length === 0) {
        console.log('ℹ️  No active work detected.');
        return;
    }
    console.log('🔄 Active Parallel Work:');
    console.log('─'.repeat(80));
    for (const w of active) {
        console.log(`  Branch: ${w.branch || '?'} | Actor: ${w.actor_name} | Last: ${w.timestamp}`);
        if (w.summary)
            console.log(`    ${w.summary}`);
    }
});
// ============================================================
// PRE-FLIGHT CHECK
// ============================================================
program
    .command('preflight')
    .description('Run pre-flight check before starting work (cross-agent awareness)')
    .requiredOption('--actor <name>', 'Your actor name')
    .option('--branch <branch>', 'Target branch')
    .option('--quiet', 'Only output if conflicts found')
    .action((opts) => {
    const result = (0, preflight_1.runPreFlight)(opts.actor, {
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
const ownershipCmd = program.command('ownership').description('Manage unit ownership (single-writer guarantee)');
ownershipCmd
    .command('claim')
    .description('Claim a unit for exclusive write access')
    .requiredOption('--unit <key>', 'Unit key (e.g., src/renderer)')
    .requiredOption('--actor <name>', 'Actor name')
    .action((opts) => {
    const result = (0, ownership_1.claim)(opts.unit, opts.actor);
    console.log(result.message);
    if (!result.success)
        process.exit(1);
});
ownershipCmd
    .command('release')
    .description('Release a claimed unit')
    .requiredOption('--unit <key>', 'Unit key')
    .requiredOption('--actor <name>', 'Actor name')
    .action((opts) => {
    const result = (0, ownership_1.release)(opts.unit, opts.actor);
    console.log(result.message);
    if (!result.success)
        process.exit(1);
});
ownershipCmd
    .command('list')
    .description('List all current ownership claims')
    .option('--actor <name>', 'Filter by actor')
    .action((opts) => {
    const claims = (0, ownership_1.listAllClaims)(opts.actor);
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
ownershipCmd
    .command('check')
    .description('Check who owns a unit (for hooks)')
    .requiredOption('--unit <key>', 'Unit key')
    .option('--quiet', 'Only output owner name')
    .action((opts) => {
    const claims = (0, ownership_1.listAllClaims)();
    const owner = claims.find(c => c.unit_key === opts.unit);
    if (owner) {
        if (opts.quiet) {
            console.log(owner.agent_name);
        }
        else {
            console.log(`Unit "${opts.unit}" owned by: ${owner.agent_name} (since ${owner.claimed_at})`);
        }
    }
    else {
        if (!opts.quiet)
            console.log(`Unit "${opts.unit}" is free.`);
    }
});
// ============================================================
// SMART MERGE
// ============================================================
program
    .command('merge-order')
    .description('Analyze branches and recommend merge order based on dependencies')
    .action(() => {
    const result = (0, merge_1.analyzeMergeOrder)();
    for (const rec of result.recommendations) {
        console.log(rec);
    }
});
program
    .command('merge-cleanup')
    .description('Clean up flight records and claims after a branch merge')
    .requiredOption('--branch <branch>', 'The merged branch name')
    .action((opts) => {
    const result = (0, merge_1.mergeCleanup)(opts.branch);
    console.log(result.message);
});
// ============================================================
// WORKFLOW (V-Model)
// ============================================================
const workflowCmd = program.command('workflow').description('V-Model workflow management');
workflowCmd
    .command('branch')
    .description('Create/switch to the correct branch for a backlog item')
    .requiredOption('--item <id>', 'Backlog item ID')
    .option('--base <branch>', 'Base branch (default: HEAD)')
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        const item = (0, db_3.getBacklogItem)(db, opts.item);
        if (!item) {
            console.log(`❌ Item ${opts.item} not found in backlog.`);
            process.exit(1);
        }
        const result = (0, branch_naming_1.createItemBranch)(item.item_id, item.type, item.title, opts.base);
        if (result.success) {
            console.log(`✅ On branch: ${result.branch}`);
        }
        else {
            console.log(`❌ Failed: ${result.error}`);
            process.exit(1);
        }
    }
    finally {
        db.close();
    }
});
workflowCmd
    .command('check-branch')
    .description('Validate current branch against expected branch for an item')
    .requiredOption('--item <id>', 'Backlog item ID')
    .option('--mode <mode>', 'advisory or binding', 'advisory')
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        const item = (0, db_3.getBacklogItem)(db, opts.item);
        if (!item) {
            console.log(`❌ Item ${opts.item} not found.`);
            process.exit(1);
        }
        const result = (0, branch_naming_1.checkBranch)(item.item_id, item.type, item.title, opts.mode);
        console.log(result.message);
        if (result.recommendation === 'block')
            process.exit(1);
    }
    finally {
        db.close();
    }
});
workflowCmd
    .command('phase-done')
    .description('Mark a V-Model phase as complete (sets git tag)')
    .requiredOption('--item <id>', 'Backlog item ID')
    .requiredOption('--phase <phase>', `Phase: ${v_model_1.V_MODEL_PHASES.join(', ')}`)
    .option('--message <msg>', 'Tag message')
    .action((opts) => {
    const phase = opts.phase;
    if (!v_model_1.V_MODEL_PHASES.includes(phase)) {
        console.log(`❌ Invalid phase "${opts.phase}". Valid: ${v_model_1.V_MODEL_PHASES.join(', ')}`);
        process.exit(1);
    }
    const result = (0, v_model_1.setPhaseTag)(opts.item, phase, opts.message);
    if (result.success) {
        console.log(`✅ Phase tag set: ${result.tag}`);
        const next = (0, v_model_1.getNextPhase)(opts.item, 'FEAT');
        if (next) {
            console.log(`   Next phase: ${next}`);
        }
        else {
            console.log(`   All phases complete! Ready for review.`);
        }
    }
    else {
        console.log(`❌ Failed to set tag: ${result.error}`);
    }
});
workflowCmd
    .command('phases')
    .description('Show completed and remaining phases for an item')
    .requiredOption('--item <id>', 'Backlog item ID')
    .option('--type <type>', 'Item type (FEAT, EPIC, FIX, IMP)', 'FEAT')
    .action((opts) => {
    const completed = (0, v_model_1.getCompletedPhases)(opts.item);
    const required = (0, v_model_1.getRequiredPhases)(opts.type);
    const next = (0, v_model_1.getNextPhase)(opts.item, opts.type);
    console.log(`📋 V-Model Phases for ${opts.item} (${opts.type}):`);
    console.log('─'.repeat(50));
    for (const phase of required) {
        const done = completed.includes(phase);
        const current = phase === next;
        const marker = done ? '✅' : current ? '👉' : '⬜';
        console.log(`  ${marker} ${phase.toUpperCase()}${current ? ' (next)' : ''}`);
    }
});
workflowCmd
    .command('transition')
    .description('Validate and execute a status transition (state-machine guard)')
    .requiredOption('--item <id>', 'Backlog item ID')
    .requiredOption('--to <status>', `Target status: ${v_model_1.ITEM_STATUSES.join(', ')}`)
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        const item = (0, db_3.getBacklogItem)(db, opts.item);
        if (!item) {
            console.log(`❌ Item ${opts.item} not found.`);
            process.exit(1);
        }
        const error = (0, v_model_1.validateStatusTransition)(item.status, opts.to, opts.item);
        if (error) {
            console.log(`❌ ${error}`);
            process.exit(1);
        }
        (0, db_3.updateBacklogStatus)(db, opts.item, opts.to.toUpperCase());
        console.log(`✅ ${opts.item}: ${item.status} → ${opts.to.toUpperCase()}`);
    }
    finally {
        db.close();
    }
});
// ============================================================
// BUILD CONTEXT (Cross-Branch PR & ADR Awareness)
// ============================================================
program
    .command('build-context')
    .description('Scan all branches for ready PRs, global ADRs, and dependencies')
    .option('--json', 'Output as JSON (for CI/CD pipelines)')
    .action((opts) => {
    const report = (0, build_1.scanBuildContext)();
    if (opts.json) {
        console.log((0, build_1.formatBuildContextJSON)(report));
    }
    else {
        console.log((0, build_1.formatBuildContextReport)(report));
    }
});
// ============================================================
// SKILLS
// ============================================================
const skillsCmd = program.command('skills').description('Skill discovery and phase routing');
skillsCmd
    .command('list')
    .description('List all available skills')
    .action(() => {
    const skills = (0, skills_1.listSkills)();
    if (skills.length === 0) {
        console.log('ℹ️  No skills found. Add skills to .nexus/skills/ or ~/.nexus/skills/');
        return;
    }
    console.log('🧠 Available Skills:');
    console.log('─'.repeat(60));
    for (const s of skills) {
        console.log(`  ${s.name}: ${s.description}`);
        if (s.phases.length > 0)
            console.log(`    Phases: ${s.phases.join(', ')}`);
    }
});
skillsCmd
    .command('route')
    .description('Get the skills and prompt for a specific V-Model phase')
    .requiredOption('--phase <phase>', `Phase: ${v_model_1.V_MODEL_PHASES.join(', ')}`)
    .option('--prompt-only', 'Only output the combined prompt (for piping to agents)')
    .action((opts) => {
    const phase = opts.phase;
    if (!v_model_1.V_MODEL_PHASES.includes(phase)) {
        console.log(`❌ Invalid phase. Valid: ${v_model_1.V_MODEL_PHASES.join(', ')}`);
        process.exit(1);
    }
    const result = (0, skills_1.routePhase)(phase);
    if (opts.promptOnly) {
        console.log(result.combinedPrompt);
        return;
    }
    console.log(`🧠 Skills for phase: ${phase.toUpperCase()}`);
    console.log('─'.repeat(60));
    console.log('Required:');
    for (const s of result.requiredSkills) {
        console.log(`  ✅ ${s.name}: ${s.description}`);
    }
    if (result.optionalSkills.length > 0) {
        console.log('Optional:');
        for (const s of result.optionalSkills) {
            console.log(`  ⬜ ${s.name}: ${s.description}`);
        }
    }
});
// ============================================================
// CONTEXT BUDGET
// ============================================================
program
    .command('budget')
    .description('Show context budget allocation')
    .option('--tokens <n>', 'Context window size in tokens', '200000')
    .action((opts) => {
    const budget = (0, context_budget_1.computeBudgets)(parseInt(opts.tokens));
    console.log('📊 Context Budget Allocation:');
    console.log('─'.repeat(50));
    console.log(`  Total:         ${budget.totalTokens.toLocaleString()} tokens (${budget.totalChars.toLocaleString()} chars)`);
    console.log(`  System:        ${budget.systemBudgetChars.toLocaleString()} chars (10%)`);
    console.log(`  Rules/ADRs:    ${budget.rulesBudgetChars.toLocaleString()} chars (10%)`);
    console.log(`  Active Work:   ${budget.activeWorkBudgetChars.toLocaleString()} chars (15%)`);
    console.log(`  Inline Files:  ${budget.inlineContextBudgetChars.toLocaleString()} chars (35%)`);
    console.log(`  Response:      ${budget.responseBudgetChars.toLocaleString()} chars (30%)`);
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
    const db = (0, db_1.getDatabase)();
    try {
        (0, db_2.createADR)(db, {
            id: opts.id,
            title: opts.title,
            status: 'proposed',
            context: opts.context,
            decision: opts.decision,
            consequences: opts.consequences,
            created_by: opts.actor,
        });
        console.log(`✅ ADR ${opts.id} created: "${opts.title}"`);
    }
    finally {
        db.close();
    }
});
adrCmd
    .command('list')
    .description('List all ADRs')
    .option('--status <status>', 'Filter by status (proposed, accepted, deprecated)')
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        const adrs = (0, db_2.listADRs)(db, opts.status);
        if (adrs.length === 0) {
            console.log('ℹ️  No ADRs found.');
            return;
        }
        console.log('📋 Architecture Decision Records:');
        console.log('─'.repeat(80));
        for (const adr of adrs) {
            console.log(`  [${adr.status.toUpperCase()}] ${adr.id}: ${adr.title}`);
            if (adr.decision)
                console.log(`    Decision: ${adr.decision}`);
        }
    }
    finally {
        db.close();
    }
});
adrCmd
    .command('accept')
    .description('Accept a proposed ADR (makes it globally binding)')
    .requiredOption('--id <id>', 'ADR ID')
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        (0, db_2.updateADRStatus)(db, opts.id, 'accepted');
        console.log(`✅ ADR ${opts.id} accepted. This ADR is now globally binding for all agents.`);
    }
    finally {
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
    .requiredOption('--id <id>', 'Item ID (e.g., FEAT-01-01)')
    .requiredOption('--title <title>', 'Item title')
    .requiredOption('--type <type>', 'Type: FEAT, FIX, IMP, EPIC, ADR, PLAN')
    .option('--priority <p>', 'Priority: P0, P1, P2, P3', 'P1')
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        (0, db_3.createBacklogItem)(db, {
            item_id: opts.id,
            title: opts.title,
            type: opts.type.toUpperCase(),
            status: 'NEW',
            priority: opts.priority.toUpperCase(),
        });
        const branch = (0, branch_naming_1.deriveBranchName)(opts.id, opts.type.toUpperCase(), opts.title);
        console.log(`✅ Backlog item ${opts.id} created: "${opts.title}"`);
        console.log(`   Expected branch: ${branch}`);
    }
    finally {
        db.close();
    }
});
backlogCmd
    .command('list')
    .description('List backlog items')
    .option('--status <status>', 'Filter by status')
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        const items = (0, db_3.listBacklog)(db, opts.status);
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
    }
    finally {
        db.close();
    }
});
backlogCmd
    .command('claim')
    .description('Claim a backlog item (prevents double work)')
    .requiredOption('--id <id>', 'Item ID')
    .requiredOption('--actor <name>', 'Actor name')
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        (0, db_3.claimBacklogItem)(db, opts.id, opts.actor);
        console.log(`✅ ${opts.actor} claimed ${opts.id}`);
    }
    finally {
        db.close();
    }
});
backlogCmd
    .command('status')
    .description('Update backlog item status (with state-machine guard)')
    .requiredOption('--id <id>', 'Item ID')
    .requiredOption('--status <status>', 'New status: Backlog, Ready, In Progress, In Review, Done')
    .action((opts) => {
    const db = (0, db_1.getDatabase)();
    try {
        const item = (0, db_3.getBacklogItem)(db, opts.id);
        if (!item) {
            console.log(`❌ Item ${opts.id} not found.`);
            process.exit(1);
        }
        // State-machine guard
        const error = (0, v_model_1.validateStatusTransition)(item.status, opts.status, opts.id);
        if (error) {
            console.log(`❌ GUARD: ${error}`);
            process.exit(1);
        }
        (0, db_3.updateBacklogStatus)(db, opts.id, opts.status);
        console.log(`✅ ${opts.id} status: ${item.status} → ${opts.status}`);
    }
    finally {
        db.close();
    }
});
// ============================================================
// STATUS (Full Overview)
// ============================================================
program
    .command('status')
    .description('Show full Nexus project status (Multi-Agent overview)')
    .action(() => {
    const db = (0, db_1.getDatabase)();
    try {
        const activeWork = hooks_1.flightRecorder.getActive();
        const claims = (0, ownership_1.listAllClaims)();
        const adrs = (0, db_2.listADRs)(db, 'accepted');
        const backlog = (0, db_3.listBacklog)(db);
        const sessions = (0, hooks_1.getActiveSessions)();
        const inProgress = backlog.filter(i => i.status === 'IN_PROGRESS').length;
        const inReview = backlog.filter(i => i.status === 'IN_REVIEW').length;
        const done = backlog.filter(i => i.status === 'DONE').length;
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║           NEXUS PROJECT STATUS (Multi-Agent)                 ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`  🔄 Active Sessions: ${sessions.length} agent(s)/user(s)`);
        console.log(`  🔒 Unit Claims:     ${claims.length} active`);
        console.log(`  📚 Accepted ADRs:   ${adrs.length}`);
        console.log(`  📋 In Progress:     ${inProgress} item(s)`);
        console.log(`  👁️  In Review:       ${inReview} item(s)`);
        console.log(`  ✅ Done:            ${done} item(s)`);
        console.log('');
        if (sessions.length > 0) {
            console.log('  Active Agents:');
            for (const s of sessions) {
                console.log(`    • ${s.actor} (${s.type}) on ${s.branch}`);
            }
            console.log('');
        }
        if (claims.length > 0) {
            console.log('  Ownership Claims:');
            for (const c of claims) {
                console.log(`    • ${c.unit_key} → ${c.agent_name}`);
            }
            console.log('');
        }
        if (activeWork.length > 0) {
            console.log('  Recent Activity:');
            for (const w of activeWork.slice(0, 5)) {
                console.log(`    • ${w.actor_name}: ${w.action} on ${w.branch} (${w.timestamp})`);
            }
        }
    }
    finally {
        db.close();
    }
});
//# sourceMappingURL=index.js.map