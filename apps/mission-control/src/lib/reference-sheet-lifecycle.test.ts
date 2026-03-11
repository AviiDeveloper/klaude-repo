import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReferenceSheetTransition } from './reference-sheet-lifecycle';

test('create transition requires empty history', () => {
  const ok = validateReferenceSheetTransition({
    action: 'create',
    hasExistingSheets: false,
    currentState: null,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.toState, 'active');

  const blocked = validateReferenceSheetTransition({
    action: 'create',
    hasExistingSheets: true,
    currentState: 'active',
  });
  assert.equal(blocked.ok, false);
});

test('version/revise require non-archived base state', () => {
  const version = validateReferenceSheetTransition({
    action: 'version',
    hasExistingSheets: true,
    currentState: 'active',
  });
  assert.equal(version.ok, true);
  assert.equal(version.toState, 'active');

  const revise = validateReferenceSheetTransition({
    action: 'revise',
    hasExistingSheets: true,
    currentState: 'draft',
  });
  assert.equal(revise.ok, true);
  assert.equal(revise.toState, 'draft');

  const blocked = validateReferenceSheetTransition({
    action: 'version',
    hasExistingSheets: true,
    currentState: 'archived',
  });
  assert.equal(blocked.ok, false);
});

test('archive transition blocks already-archived sheets', () => {
  const allowed = validateReferenceSheetTransition({
    action: 'archive',
    hasExistingSheets: true,
    currentState: 'active',
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.toState, 'archived');

  const blocked = validateReferenceSheetTransition({
    action: 'archive',
    hasExistingSheets: true,
    currentState: 'archived',
  });
  assert.equal(blocked.ok, false);
});
