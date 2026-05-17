"use strict";
/**
 * Nexus Framework - Skill System with Auto-Discovery & Phase Routing
 *
 * Skills are modular capabilities that agents load based on the current
 * V-Model phase. The router automatically selects the right skill(s)
 * for the current phase and provides the agent with the correct prompt,
 * templates, and constraints.
 *
 * This is the DIA skill pattern adapted for Multi-Agent:
 * - Skills live in .nexus/skills/ or a global skills directory
 * - Each skill has a SKILL.md with instructions
 * - The router maps V-Model phases to required skills
 * - Multiple agents can use the same skill simultaneously (read-only)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverSkills = discoverSkills;
exports.routePhase = routePhase;
exports.listSkills = listSkills;
const fs_1 = require("fs");
const path_1 = require("path");
const db_1 = require("../db");
// ─── Phase-to-Skill Mapping ───────────────────────────────────────────────────
/**
 * Default mapping of V-Model phases to required skill names.
 * Can be overridden by .nexus/skill-config.json in the project.
 */
const DEFAULT_PHASE_SKILLS = {
    'ba': ['requirements-engineering', 'project-conventions'],
    're': ['requirements-engineering', 'project-conventions'],
    'arch': ['architecture', 'project-conventions'],
    'code': ['coding', 'project-conventions'],
    'test': ['testing', 'project-conventions'],
    'sec': ['security-audit', 'project-conventions'],
    'review': ['code-review', 'project-conventions'],
    'release': ['release-management', 'project-conventions'],
};
/**
 * Skills that are always loaded regardless of phase (Multi-Agent essentials).
 */
const ALWAYS_LOADED_SKILLS = ['nexus-coordination'];
// ─── Skill Discovery ──────────────────────────────────────────────────────────
/**
 * Discovers all available skills in the project and global skill directories.
 * Searches in order:
 * 1. .nexus/skills/ (project-local)
 * 2. ~/.nexus/skills/ (user-global)
 * 3. <nexus-install>/skills/ (framework-bundled)
 */
function discoverSkills() {
    const skills = [];
    const searchPaths = [];
    // Project-local skills
    try {
        const root = (0, db_1.findProjectRoot)();
        const projectSkills = (0, path_1.join)(root, '.nexus', 'skills');
        if ((0, fs_1.existsSync)(projectSkills))
            searchPaths.push(projectSkills);
    }
    catch { /* not in a project */ }
    // User-global skills
    const homeSkills = (0, path_1.join)(process.env.HOME || '/home/ubuntu', '.nexus', 'skills');
    if ((0, fs_1.existsSync)(homeSkills))
        searchPaths.push(homeSkills);
    // Framework-bundled skills
    const frameworkSkills = (0, path_1.join)(__dirname, '..', '..', 'skills');
    if ((0, fs_1.existsSync)(frameworkSkills))
        searchPaths.push(frameworkSkills);
    for (const searchPath of searchPaths) {
        try {
            const entries = (0, fs_1.readdirSync)(searchPath);
            for (const entry of entries) {
                const skillDir = (0, path_1.join)(searchPath, entry);
                if (!(0, fs_1.statSync)(skillDir).isDirectory())
                    continue;
                const skillMd = (0, path_1.join)(skillDir, 'SKILL.md');
                if (!(0, fs_1.existsSync)(skillMd))
                    continue;
                const content = (0, fs_1.readFileSync)(skillMd, 'utf-8');
                const skill = parseSkill(entry, skillDir, content);
                if (skill)
                    skills.push(skill);
            }
        }
        catch { /* skip inaccessible directories */ }
    }
    return skills;
}
/**
 * Parses a SKILL.md file into a Skill object.
 */
function parseSkill(name, skillPath, content) {
    // Extract description from first paragraph
    const descMatch = content.match(/^#[^\n]*\n+([^\n]+)/);
    const description = descMatch ? descMatch[1].trim() : '';
    // Extract phase annotations (if present)
    const phaseMatch = content.match(/phases?:\s*\[([^\]]+)\]/i);
    let phases = [];
    if (phaseMatch) {
        phases = phaseMatch[1].split(',').map(p => p.trim().replace(/['"]/g, ''));
    }
    // Discover templates
    const templatesDir = (0, path_1.join)(skillPath, 'templates');
    let templates = [];
    if ((0, fs_1.existsSync)(templatesDir)) {
        templates = (0, fs_1.readdirSync)(templatesDir).map(f => (0, path_1.join)(templatesDir, f));
    }
    // Discover references
    const refsDir = (0, path_1.join)(skillPath, 'references');
    let references = [];
    if ((0, fs_1.existsSync)(refsDir)) {
        references = (0, fs_1.readdirSync)(refsDir).map(f => (0, path_1.join)(refsDir, f));
    }
    return {
        name,
        path: skillPath,
        description,
        phases,
        content,
        templates,
        references,
    };
}
// ─── Phase Routing ────────────────────────────────────────────────────────────
/**
 * Routes the current phase to the appropriate skills.
 * Returns the combined prompt that should be injected into the agent's context.
 */
function routePhase(phase) {
    const allSkills = discoverSkills();
    const requiredNames = [...(DEFAULT_PHASE_SKILLS[phase] || []), ...ALWAYS_LOADED_SKILLS];
    // Load custom phase-skill mapping if exists
    let customMapping = null;
    try {
        const root = (0, db_1.findProjectRoot)();
        const configPath = (0, path_1.join)(root, '.nexus', 'skill-config.json');
        if ((0, fs_1.existsSync)(configPath)) {
            customMapping = JSON.parse((0, fs_1.readFileSync)(configPath, 'utf-8'));
        }
    }
    catch { /* no custom config */ }
    if (customMapping && customMapping[phase]) {
        requiredNames.push(...customMapping[phase]);
    }
    // Match skills
    const requiredSkills = [];
    const optionalSkills = [];
    for (const skill of allSkills) {
        if (requiredNames.includes(skill.name)) {
            requiredSkills.push(skill);
        }
        else if (skill.phases.includes(phase)) {
            optionalSkills.push(skill);
        }
    }
    // Build combined prompt
    const combinedPrompt = buildCombinedPrompt(phase, requiredSkills, optionalSkills);
    return {
        phase,
        requiredSkills,
        optionalSkills,
        combinedPrompt,
    };
}
/**
 * Builds the combined prompt from all loaded skills for the current phase.
 */
function buildCombinedPrompt(phase, required, optional) {
    const sections = [];
    sections.push(`# Nexus Framework - Phase: ${phase.toUpperCase()}`);
    sections.push('');
    sections.push('You are operating within the Nexus Framework Multi-Agent SDLC.');
    sections.push(`Current phase: **${phase}**`);
    sections.push('');
    sections.push('## Mandatory Rules (from loaded skills)');
    sections.push('');
    for (const skill of required) {
        sections.push(`### Skill: ${skill.name}`);
        sections.push('');
        sections.push(skill.content);
        sections.push('');
        sections.push('---');
        sections.push('');
    }
    if (optional.length > 0) {
        sections.push('## Optional Skills (available but not required)');
        sections.push('');
        for (const skill of optional) {
            sections.push(`- **${skill.name}**: ${skill.description}`);
        }
        sections.push('');
    }
    return sections.join('\n');
}
// ─── Skill Listing ────────────────────────────────────────────────────────────
/**
 * Lists all available skills with their phase associations.
 */
function listSkills() {
    return discoverSkills().map(s => ({
        name: s.name,
        description: s.description,
        phases: s.phases,
        path: s.path,
    }));
}
//# sourceMappingURL=skill-router.js.map