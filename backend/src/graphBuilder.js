/**
 * graphBuilder.js
 * -------------------------------------------------------------
 * Takes validated edges and builds:
 *   - children map (node -> sorted array of children)
 *   - parents map  (node -> first-encountered parent, per spec)
 *   - connected components via Union-Find (path compression + union by rank)
 *   - duplicate_edges list (one entry per repeated Parent->Child pair)
 *
 * Spec rules enforced here:
 *   - Duplicate edges: first occurrence is used, all subsequent copies
 *     are pushed to duplicate_edges ONCE (regardless of repeat count).
 *   - Diamond / multi-parent: the first parent wins; subsequent parent
 *     edges for the same child are silently discarded.
 */

class UnionFind {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  add(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x) {
    // Iterative path compression to avoid recursion stack depth.
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root);
    }
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const raRank = this.rank.get(ra);
    const rbRank = this.rank.get(rb);
    if (raRank < rbRank) {
      this.parent.set(ra, rb);
    } else if (raRank > rbRank) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, raRank + 1);
    }
  }
}

/**
 * Build graph structures from the list of validated entries.
 *
 * @param {Array<{ok:boolean, parent?:string, child?:string, raw:string}>} validatedEntries
 * @returns {{
 *   children: Map<string, string[]>,
 *   parents: Map<string, string>,
 *   nodes: Set<string>,
 *   acceptedEdges: Array<{parent:string, child:string}>,
 *   duplicateEdges: string[],
 *   components: Map<string, string[]>   // root -> list of member nodes
 * }}
 */
function buildGraph(validatedEntries) {
  const children = new Map();      // parent -> Set<child>
  const parents = new Map();       // child -> first parent seen
  const nodes = new Set();
  const seenEdges = new Set();     // "A->B" strings we've already accepted
  const duplicatePairs = new Set(); // to dedupe the duplicate_edges list
  const duplicateEdges = [];       // preserves first-seen-duplicate order
  const acceptedEdges = [];
  const uf = new UnionFind();

  for (const v of validatedEntries) {
    if (!v.ok) continue;

    const key = `${v.parent}->${v.child}`;

    // Duplicate edge rule: push ONCE per pair regardless of repetition.
    if (seenEdges.has(key)) {
      if (!duplicatePairs.has(key)) {
        duplicatePairs.add(key);
        duplicateEdges.push(key);
      }
      continue;
    }
    seenEdges.add(key);

    // Diamond resolution: first parent wins for any given child.
    // If the child already has a parent, silently discard this edge
    // for tree-building purposes. BUT: we still record the nodes and
    // connect them in the union-find, so the component stays whole.
    nodes.add(v.parent);
    nodes.add(v.child);
    uf.add(v.parent);
    uf.add(v.child);
    uf.union(v.parent, v.child);

    if (parents.has(v.child)) {
      // silently discarded per spec
      continue;
    }

    parents.set(v.child, v.parent);
    if (!children.has(v.parent)) children.set(v.parent, new Set());
    children.get(v.parent).add(v.child);
    acceptedEdges.push({ parent: v.parent, child: v.child });
  }

  // Convert children sets to sorted arrays for deterministic output.
  const childrenSorted = new Map();
  for (const [p, set] of children.entries()) {
    childrenSorted.set(p, Array.from(set).sort());
  }

  // Group nodes by component root.
  const components = new Map();
  for (const n of nodes) {
    const r = uf.find(n);
    if (!components.has(r)) components.set(r, []);
    components.get(r).push(n);
  }
  // Sort members for stable output.
  for (const arr of components.values()) arr.sort();

  return {
    children: childrenSorted,
    parents,
    nodes,
    acceptedEdges,
    duplicateEdges,
    components,
  };
}

module.exports = { buildGraph };
