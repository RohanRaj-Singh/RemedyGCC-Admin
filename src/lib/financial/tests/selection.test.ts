import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearIds,
  clearSelection,
  selectAllIds,
  selectMany,
  selectionCount,
  selectionTotal,
  toggleId,
  toggleSelection,
} from '../selection';

describe('toggleSelection', () => {
  it('adds an id with its amount when absent', () => {
    const next = toggleSelection(new Map(), 'a', 100);
    assert.equal(next.get('a'), 100);
  });

  it('removes the id when already present', () => {
    const next = toggleSelection(new Map([['a', 100]]), 'a', 100);
    assert.equal(next.has('a'), false);
  });

  it('does not mutate the input map', () => {
    const original = new Map([['a', 100]]);
    const next = toggleSelection(original, 'b', 200);
    assert.equal(original.has('b'), false);
    assert.equal(next.get('b'), 200);
  });
});

describe('selectMany', () => {
  it('adds every entry, overwriting existing amounts', () => {
    const next = selectMany(new Map([['a', 100]]), [
      { id: 'a', amount: 150 },
      { id: 'b', amount: 200 },
    ]);
    assert.equal(next.get('a'), 150);
    assert.equal(next.get('b'), 200);
    assert.equal(next.size, 2);
  });
});

describe('clearSelection / count / total', () => {
  it('clears and counts/totals correctly', () => {
    const selection = new Map<string, number>([
      ['a', 100],
      ['b', 200.5],
    ]);
    assert.equal(selectionCount(selection), 2);
    assert.equal(selectionTotal(selection), 300.5);
    assert.equal(selectionCount(clearSelection()), 0);
    assert.equal(selectionTotal(clearSelection()), 0);
  });
});

describe('toggleId / selectAllIds / clearIds', () => {
  it('toggles an id in an array', () => {
    assert.deepEqual(toggleId(['a'], 'b'), ['a', 'b']);
    assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b']);
  });

  it('selects all eligible ids as a copy', () => {
    const eligible = ['a', 'b', 'c'];
    const selected = selectAllIds(eligible);
    assert.deepEqual(selected, eligible);
    assert.notEqual(selected, eligible);
  });

  it('clears to an empty array', () => {
    assert.deepEqual(clearIds(), []);
  });
});
