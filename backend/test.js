/**
 * test.js — Lightweight sanity tests (no framework needed).
 * Run with: node test.js
 */

const { processData } = require('./src/processor');

let pass = 0;
let fail = 0;

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`    expected: ${e}`);
    console.log(`    actual:   ${a}`);
    fail++;
  }
}

console.log('\n=== SPEC EXAMPLE ===');
{
  const data = [
    'A->B', 'A->C', 'B->D', 'C->E', 'E->F',
    'X->Y', 'Y->Z', 'Z->X',
    'P->Q', 'Q->R',
    'G->H', 'G->H', 'G->I',
    'hello', '1->2', 'A->',
  ];
  const r = processData(data);
  eq(r.invalid_entries, ['hello', '1->2', 'A->'], 'invalid_entries');
  eq(r.duplicate_edges, ['G->H'], 'duplicate_edges');
  eq(r.summary, { total_trees: 3, total_cycles: 1, largest_tree_root: 'A' }, 'summary');
  eq(r.hierarchies.length, 4, 'four hierarchies');
  const A = r.hierarchies.find(h => h.root === 'A');
  eq(A.depth, 4, 'A depth = 4');
  eq(A.tree, { A: { B: { D: {} }, C: { E: { F: {} } } } }, 'A tree shape');
  const X = r.hierarchies.find(h => h.root === 'X');
  eq(X.has_cycle, true, 'X has_cycle=true');
  eq(X.tree, {}, 'X tree={}');
  eq('depth' in X, false, 'X has no depth field');
}

console.log('\n=== INVALID FORMATS ===');
{
  const r = processData(['A->A', 'AB->C', '1->2', 'A-B', 'A->', '->B', '', '  ', 'hello']);
  eq(r.invalid_entries.length, 9, 'all 9 invalid');
  eq(r.hierarchies.length, 0, 'no hierarchies');
  eq(r.summary.total_trees, 0, 'no trees');
}

console.log('\n=== TRIM WHITESPACE ===');
{
  const r = processData([' A->B ', '\tB->C\n']);
  eq(r.invalid_entries, [], 'trimmed inputs accepted');
  eq(r.hierarchies[0].depth, 3, 'depth 3 after trim');
}

console.log('\n=== DUPLICATE EDGES (many repeats) ===');
{
  const r = processData(['A->B', 'A->B', 'A->B', 'A->B']);
  eq(r.duplicate_edges, ['A->B'], 'duplicate listed once');
}

console.log('\n=== DIAMOND (first parent wins) ===');
{
  const r = processData(['A->D', 'B->D', 'A->B']);
  // Tree should be A->B->D (B is parent of D? No: A->D is first so D's parent is A).
  // Accepted: A->D, B->D(discarded since D already has parent A), A->B.
  // children: A=[B,D], B=[]; parents: D=A, B=A. Root=A. Depth=2.
  eq(r.hierarchies.length, 1, 'single component');
  eq(r.hierarchies[0].root, 'A', 'root A');
  eq(r.hierarchies[0].depth, 2, 'depth 2');
  eq(r.hierarchies[0].tree, { A: { B: {}, D: {} } }, 'diamond resolved');
}

console.log('\n=== PURE CYCLE (no root) ===');
{
  const r = processData(['B->C', 'C->A', 'A->B']);
  eq(r.hierarchies.length, 1, 'single component');
  eq(r.hierarchies[0].has_cycle, true, 'cycle detected');
  eq(r.hierarchies[0].root, 'A', 'lex smallest root A');
  eq(r.hierarchies[0].tree, {}, 'empty tree');
}

console.log('\n=== EMPTY DATA ===');
{
  const r = processData([]);
  eq(r.hierarchies, [], 'no hierarchies');
  eq(r.invalid_entries, [], 'no invalids');
  eq(r.duplicate_edges, [], 'no duplicates');
  eq(r.summary, { total_trees: 0, total_cycles: 0, largest_tree_root: '' }, 'zero summary');
}

console.log('\n=== TIEBREAK (equal depth -> lex smaller root) ===');
{
  const r = processData(['C->D', 'A->B']);
  // Two trees both depth 2. Largest should be A.
  eq(r.summary.largest_tree_root, 'A', 'tiebreak A < C');
}

console.log('\n=== SINGLE EDGE -> DEPTH 2 ===');
{
  const r = processData(['A->B']);
  eq(r.hierarchies[0].depth, 2, 'single edge = depth 2');
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
