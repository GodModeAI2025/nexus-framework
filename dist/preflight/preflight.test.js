"use strict";
/**
 * Nexus Framework - Pre-Flight Scope Matching Tests
 * Run: pnpm build && pnpm test
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const preflight_1 = require("./preflight");
(0, node_test_1.test)('a claimed directory covers the files inside it', () => {
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src/auth/login.ts'), true);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src/auth/session/store.ts'), true);
});
(0, node_test_1.test)('a claimed file matches only itself', () => {
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth/login.ts', 'src/auth/login.ts'), true);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth/login.ts', 'src/auth/logout.ts'), false);
});
(0, node_test_1.test)('matching stops at path boundaries (no sibling false positives)', () => {
    // The old prefix check blocked these: "src/authority.ts".startsWith("src/auth")
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src/authority.ts'), false);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src/authentication/login.ts'), false);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('lib/db', 'lib/dbt/runner.ts'), false);
});
(0, node_test_1.test)('a file inside a declared directory reports the directory claim', () => {
    // Reverse direction: I declare "src", someone else claims "src/auth"
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src'), true);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src', 'srcs/auth'), false);
});
(0, node_test_1.test)('unrelated units never overlap', () => {
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src/payments/stripe.ts'), false);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('docs', 'src'), false);
});
(0, node_test_1.test)('normalization ignores "./", trailing slashes and whitespace', () => {
    strict_1.default.equal((0, preflight_1.normalizeScope)('  ./src/auth/  '), 'src/auth');
    strict_1.default.equal((0, preflight_1.scopesOverlap)('./src/auth/', 'src/auth/login.ts'), true);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', './src/auth'), true);
});
(0, node_test_1.test)('normalization handles backslashes, empty and dot segments', () => {
    strict_1.default.equal((0, preflight_1.normalizeScope)('src\\auth\\login.ts'), 'src/auth/login.ts');
    strict_1.default.equal((0, preflight_1.normalizeScope)('src//auth///login.ts'), 'src/auth/login.ts');
    strict_1.default.equal((0, preflight_1.normalizeScope)('src/./auth/'), 'src/auth');
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src\\auth\\login.ts'), true);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src/./auth/login.ts'), true);
});
(0, node_test_1.test)('".." is resolved, so a detour through a claimed unit is not a hit', () => {
    strict_1.default.equal((0, preflight_1.normalizeScope)('src/auth/../payments/stripe.ts'), 'src/payments/stripe.ts');
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src/auth/../payments/stripe.ts'), false);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', 'src/auth/../auth/login.ts'), true);
    // A ".." that leaves the repository is kept instead of collapsing onto the root.
    strict_1.default.equal((0, preflight_1.normalizeScope)('../other-repo/src'), '../other-repo/src');
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src', '../other-repo/src'), false);
});
(0, node_test_1.test)('empty scopes never match', () => {
    strict_1.default.equal((0, preflight_1.scopesOverlap)('', 'src/auth'), false);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('src/auth', '   '), false);
    strict_1.default.equal((0, preflight_1.scopesOverlap)('/', 'src'), false);
});
//# sourceMappingURL=preflight.test.js.map