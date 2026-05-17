/**
 * Nexus Framework - Context Budget Engine
 *
 * Implements the GSD-2 token budgeting pattern:
 * Proportional allocation of context window into segments,
 * with section-boundary-aware truncation.
 *
 * This ensures agents never overflow their context window
 * and always have room for the most important information.
 */
export interface BudgetAllocation {
    totalTokens: number;
    totalChars: number;
    rulesBudgetChars: number;
    inlineContextBudgetChars: number;
    activeWorkBudgetChars: number;
    responseBudgetChars: number;
    systemBudgetChars: number;
}
/**
 * Computes proportional budget allocation for a given context window.
 * Mirrors the GSD-2 computeBudgets() pattern.
 */
export declare function computeBudgets(contextWindowTokens?: number): BudgetAllocation;
export interface TruncationResult {
    content: string;
    truncated: boolean;
    originalLength: number;
    finalLength: number;
}
/**
 * Truncates content at markdown section boundaries (## headings).
 * Never cuts mid-section, always at a clean heading boundary.
 * This is the GSD-2 truncateAtSectionBoundary() pattern.
 */
export declare function truncateAtSectionBoundary(content: string, maxChars: number): TruncationResult;
export interface ContextBlock {
    label: string;
    content: string;
    priority: number;
    category: 'system' | 'rules' | 'active-work' | 'inline' | 'response';
}
/**
 * Assembles context blocks within budget constraints.
 * Higher priority blocks are included first.
 * Lower priority blocks are truncated or dropped if budget is exceeded.
 */
export declare function assembleContext(blocks: ContextBlock[], contextWindowTokens?: number): {
    assembled: ContextBlock[];
    dropped: string[];
    totalChars: number;
};
/**
 * Caps a preamble string to prevent bloated system prompts.
 * Uses the smaller of: MAX_PREAMBLE_CHARS or 10% of context window.
 */
export declare function capPreamble(preamble: string, contextWindowTokens?: number): string;
//# sourceMappingURL=context-budget.d.ts.map