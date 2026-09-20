/**
 * Nexus Framework - Pre-Flight Scope Matching Tests
 * Run: pnpm build && pnpm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScope, scopesOverlap } from './preflight';

test('a claimed directory covers the files inside it', () => {
  assert.equal(scopesOverlap('src/auth', 'src/auth/login.ts'), true);
  assert.equal(scopesOverlap('src/auth', 'src/auth/session/store.ts'), true);
});

test('a claimed file matches only itself', () => {
  assert.equal(scopesOverlap('src/auth/login.ts', 'src/auth/login.ts'), true);
  assert.equal(scopesOverlap('src/auth/login.ts', 'src/auth/logout.ts'), false);
});

test('matching stops at path boundaries (no sibling false positives)', () => {
  // The old prefix check blocked these: "src/authority.ts".startsWith("src/auth")
  assert.equal(scopesOverlap('src/auth', 'src/authority.ts'), false);
  assert.equal(scopesOverlap('src/auth', 'src/authentication/login.ts'), false);
  assert.equal(scopesOverlap('lib/db', 'lib/dbt/runner.ts'), false);
});

test('a file inside a declared directory reports the directory claim', () => {
  // Reverse direction: I declare "src", someone else claims "src/auth"
  assert.equal(scopesOverlap('src/auth', 'src'), true);
  assert.equal(scopesOverlap('src', 'srcs/auth'), false);
});

test('unrelated units never overlap', () => {
  assert.equal(scopesOverlap('src/auth', 'src/payments/stripe.ts'), false);
  assert.equal(scopesOverlap('docs', 'src'), false);
});

test('normalization ignores "./", trailing slashes and whitespace', () => {
  assert.equal(normalizeScope('  ./src/auth/  '), 'src/auth');
  assert.equal(scopesOverlap('./src/auth/', 'src/auth/login.ts'), true);
  assert.equal(scopesOverlap('src/auth', './src/auth'), true);
});

test('normalization handles backslashes, empty and dot segments', () => {
  assert.equal(normalizeScope('src\\auth\\login.ts'), 'src/auth/login.ts');
  assert.equal(normalizeScope('src//auth///login.ts'), 'src/auth/login.ts');
  assert.equal(normalizeScope('src/./auth/'), 'src/auth');
  assert.equal(scopesOverlap('src/auth', 'src\\auth\\login.ts'), true);
  assert.equal(scopesOverlap('src/auth', 'src/./auth/login.ts'), true);
});

test('".." is resolved, so a detour through a claimed unit is not a hit', () => {
  assert.equal(normalizeScope('src/auth/../payments/stripe.ts'), 'src/payments/stripe.ts');
  assert.equal(scopesOverlap('src/auth', 'src/auth/../payments/stripe.ts'), false);
  assert.equal(scopesOverlap('src/auth', 'src/auth/../auth/login.ts'), true);
  // A ".." that leaves the repository is kept instead of collapsing onto the root.
  assert.equal(normalizeScope('../other-repo/src'), '../other-repo/src');
  assert.equal(scopesOverlap('src', '../other-repo/src'), false);
});

test('empty scopes never match', () => {
  assert.equal(scopesOverlap('', 'src/auth'), false);
  assert.equal(scopesOverlap('src/auth', '   '), false);
  assert.equal(scopesOverlap('/', 'src'), false);
});
