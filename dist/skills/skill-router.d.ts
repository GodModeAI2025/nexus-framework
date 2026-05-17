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
import { VModelPhase } from '../workflow/v-model';
export interface Skill {
    name: string;
    path: string;
    description: string;
    phases: VModelPhase[];
    content: string;
    templates: string[];
    references: string[];
}
export interface SkillRouteResult {
    phase: VModelPhase;
    requiredSkills: Skill[];
    optionalSkills: Skill[];
    combinedPrompt: string;
}
/**
 * Discovers all available skills in the project and global skill directories.
 * Searches in order:
 * 1. .nexus/skills/ (project-local)
 * 2. ~/.nexus/skills/ (user-global)
 * 3. <nexus-install>/skills/ (framework-bundled)
 */
export declare function discoverSkills(): Skill[];
/**
 * Routes the current phase to the appropriate skills.
 * Returns the combined prompt that should be injected into the agent's context.
 */
export declare function routePhase(phase: VModelPhase): SkillRouteResult;
/**
 * Lists all available skills with their phase associations.
 */
export declare function listSkills(): {
    name: string;
    description: string;
    phases: string[];
    path: string;
}[];
//# sourceMappingURL=skill-router.d.ts.map