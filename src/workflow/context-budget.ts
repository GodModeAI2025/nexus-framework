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

// ─── Budget Constants ─────────────────────────────────────────────────────────

/** Ratio of context window allocated to project summary/rules */
const RULES_RATIO = 0.10;

/** Ratio allocated to inline file context */
const INLINE_CONTEXT_RATIO = 0.35;

/** Ratio allocated to active work context (flight records, claims) */
const ACTIVE_WORK_RATIO = 0.15;

/** Ratio allocated to the agent's working space (response) */
const RESPONSE_RATIO = 0.30;

/** Ratio reserved for system prompt and framework instructions */
const SYSTEM_RATIO = 0.10;

/** Default context window in tokens (conservative estimate) */
const DEFAULT_CONTEXT_WINDOW = 200_000;

/** Approximate characters per token (conservative) */
const CHARS_PER_TOKEN = 3.5;

// ─── Budget Allocation ────────────────────────────────────────────────────────

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
export function computeBudgets(contextWindowTokens?: number): BudgetAllocation {
  const tokens = contextWindowTokens || DEFAULT_CONTEXT_WINDOW;
  const totalChars = Math.floor(tokens * CHARS_PER_TOKEN);

  return {
    totalTokens: tokens,
    totalChars,
    rulesBudgetChars: Math.floor(totalChars * RULES_RATIO),
    inlineContextBudgetChars: Math.floor(totalChars * INLINE_CONTEXT_RATIO),
    activeWorkBudgetChars: Math.floor(totalChars * ACTIVE_WORK_RATIO),
    responseBudgetChars: Math.floor(totalChars * RESPONSE_RATIO),
    systemBudgetChars: Math.floor(totalChars * SYSTEM_RATIO),
  };
}

// ─── Section-Boundary Truncation ──────────────────────────────────────────────

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
export function truncateAtSectionBoundary(
  content: string,
  maxChars: number
): TruncationResult {
  if (content.length <= maxChars) {
    return {
      content,
      truncated: false,
      originalLength: content.length,
      finalLength: content.length,
    };
  }

  const lines = content.split('\n');
  let result = '';
  let lastSectionEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const candidate = result + line + '\n';

    if (candidate.length > maxChars) {
      // Cut at last section boundary
      if (lastSectionEnd > 0) {
        const truncatedContent = lines.slice(0, lastSectionEnd).join('\n');
        return {
          content: truncatedContent + '\n\n[... truncated, ' +
            `${content.length - truncatedContent.length} chars remaining ...]`,
          truncated: true,
          originalLength: content.length,
          finalLength: truncatedContent.length,
        };
      }
      // No section boundary found, cut at line boundary
      return {
        content: result + '\n[... truncated ...]',
        truncated: true,
        originalLength: content.length,
        finalLength: result.length,
      };
    }

    result = candidate;

    // Track section boundaries (## headings)
    if (line.startsWith('## ') || line.startsWith('### ')) {
      lastSectionEnd = i;
    }
  }

  return {
    content: result,
    truncated: false,
    originalLength: content.length,
    finalLength: result.length,
  };
}

// ─── Context Assembly ─────────────────────────────────────────────────────────

export interface ContextBlock {
  label: string;
  content: string;
  priority: number;  // 1 = highest, 5 = lowest
  category: 'system' | 'rules' | 'active-work' | 'inline' | 'response';
}

/**
 * Assembles context blocks within budget constraints.
 * Higher priority blocks are included first.
 * Lower priority blocks are truncated or dropped if budget is exceeded.
 */
export function assembleContext(
  blocks: ContextBlock[],
  contextWindowTokens?: number
): { assembled: ContextBlock[]; dropped: string[]; totalChars: number } {
  const budget = computeBudgets(contextWindowTokens);

  // Sort by priority (highest first)
  const sorted = [...blocks].sort((a, b) => a.priority - b.priority);

  const assembled: ContextBlock[] = [];
  const dropped: string[] = [];
  let usedChars = 0;

  // Budget per category
  const categoryBudget: Record<string, number> = {
    'system': budget.systemBudgetChars,
    'rules': budget.rulesBudgetChars,
    'active-work': budget.activeWorkBudgetChars,
    'inline': budget.inlineContextBudgetChars,
    'response': budget.responseBudgetChars,
  };

  const categoryUsed: Record<string, number> = {
    'system': 0,
    'rules': 0,
    'active-work': 0,
    'inline': 0,
    'response': 0,
  };

  for (const block of sorted) {
    const catBudget = categoryBudget[block.category] || budget.inlineContextBudgetChars;
    const catUsed = categoryUsed[block.category] || 0;
    const remaining = catBudget - catUsed;

    if (remaining <= 0) {
      dropped.push(block.label);
      continue;
    }

    if (block.content.length <= remaining) {
      assembled.push(block);
      categoryUsed[block.category] = catUsed + block.content.length;
      usedChars += block.content.length;
    } else {
      // Truncate at section boundary
      const truncated = truncateAtSectionBoundary(block.content, remaining);
      assembled.push({ ...block, content: truncated.content });
      categoryUsed[block.category] = catUsed + truncated.finalLength;
      usedChars += truncated.finalLength;
    }
  }

  return { assembled, dropped, totalChars: usedChars };
}

// ─── Preamble Cap (GSD-2 pattern) ────────────────────────────────────────────

const MAX_PREAMBLE_CHARS = 20_000;

/**
 * Caps a preamble string to prevent bloated system prompts.
 * Uses the smaller of: MAX_PREAMBLE_CHARS or 10% of context window.
 */
export function capPreamble(preamble: string, contextWindowTokens?: number): string {
  const budget = computeBudgets(contextWindowTokens);
  const cap = Math.min(MAX_PREAMBLE_CHARS, budget.systemBudgetChars);

  if (preamble.length <= cap) return preamble;

  return truncateAtSectionBoundary(preamble, cap).content;
}
