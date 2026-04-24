/**
 * processor.js
 * -------------------------------------------------------------
 * Orchestrates the full BFHL pipeline:
 *   validate -> build graph -> per component (find root, detect
 *   cycle, build tree, compute depth) -> assemble response.
 */

const { validateEntry } = require('./validator');
const { buildGraph } = require('./graphBuilder');
const { hasCycle } = require('./cycleDetector');
const { buildTree, computeDepth } = require('./treeBuilder');

/**
 * Process the `data` array and return the BFHL response (without identity).
 * Identity fields are attached by the HTTP handler.
 *
 * @param {unknown[]} data
 * @returns {{
 *   hierarchies: object[],
 *   invalid_entries: string[],
 *   duplicate_edges: string[],
 *   summary: { total_trees: number, total_cycles: number, largest_tree_root: string }
 * }}
 */
function processData(data) {
  // Stage 1/2: validate
  const validated = data.map(validateEntry);
  const invalid_entries = validated.filter(v => !v.ok).map(v => v.raw);

  // Stage 3/4/5: graph + components
  const { children, parents, acceptedEdges, duplicateEdges, components } =
    buildGraph(validated);

  // Stage 6-9: per component
  const hierarchies = [];
  for (const [ufRoot, members] of components.entries()) {
    // Find real root: node in this component with no parent in `parents`.
    // If none (pure cycle) → lexicographically smallest node.
    const rootless = members.filter(n => !parents.has(n));
    let root;
    if (rootless.length > 0) {
      // There could theoretically be more than one "rootless" node if some
      // edges were dropped by diamond resolution. Pick the lexicographically
      // smallest for determinism.
      rootless.sort();
      root = rootless[0];
    } else {
      root = [...members].sort()[0];
    }

    const cyc = hasCycle(members, children);

    if (cyc) {
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const tree = buildTree(root, children);
      const depth = computeDepth(root, children);
      hierarchies.push({ root, tree, depth });
    }
  }

  // Stable ordering: by root letter ascending.
  hierarchies.sort((a, b) => a.root.localeCompare(b.root));

  // Stage 10: summary
  const treesOnly = hierarchies.filter(h => !h.has_cycle);
  const total_trees = treesOnly.length;
  const total_cycles = hierarchies.length - total_trees;

  let largest_tree_root = '';
  if (treesOnly.length > 0) {
    let best = treesOnly[0];
    for (let i = 1; i < treesOnly.length; i++) {
      const h = treesOnly[i];
      if (h.depth > best.depth) best = h;
      else if (h.depth === best.depth && h.root.localeCompare(best.root) < 0) {
        best = h;
      }
    }
    largest_tree_root = best.root;
  }

  return {
    hierarchies,
    invalid_entries,
    duplicate_edges: duplicateEdges,
    summary: { total_trees, total_cycles, largest_tree_root },
  };
}

module.exports = { processData };
