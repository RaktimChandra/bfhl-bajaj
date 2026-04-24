/**
 * treeBuilder.js
 * -------------------------------------------------------------
 * Builds the nested tree object per the spec and computes depth.
 *
 * Depth = number of nodes on the longest root-to-leaf path.
 *   - single node      -> depth 1
 *   - A -> B           -> depth 2
 *   - A -> B -> C      -> depth 3
 *
 * Both build and depth are implemented iteratively to handle
 * deep trees safely.
 */

/**
 * Build the nested tree object rooted at `root`.
 * Children are already sorted alphabetically in the `children` map.
 *
 * Implementation: two-pass iterative post-order so we build each
 * subtree object before plugging it into its parent.
 *
 * @param {string} root
 * @param {Map<string, string[]>} children
 * @returns {object} nested tree, e.g. { A: { B: {}, C: { D: {} } } }
 */
function buildTree(root, children) {
  const built = new Map();                 // node -> built subtree object
  const order = [];                        // post-order traversal

  // Iterative post-order using a visit marker.
  const stack = [[root, false]];
  while (stack.length > 0) {
    const [node, visited] = stack.pop();
    if (visited) {
      order.push(node);
      continue;
    }
    stack.push([node, true]);
    const kids = children.get(node) || [];
    // Push in reverse so leftmost child is processed first when popped.
    for (let i = kids.length - 1; i >= 0; i--) {
      stack.push([kids[i], false]);
    }
  }

  for (const node of order) {
    const obj = {};
    const kids = children.get(node) || [];
    for (const k of kids) obj[k] = built.get(k);
    built.set(node, obj);
  }

  return { [root]: built.get(root) };
}

/**
 * Compute max depth (number of nodes on the longest root-to-leaf path).
 * Iterative post-order DP: depth(node) = 1 + max(depth(child)), leaves = 1.
 *
 * @param {string} root
 * @param {Map<string, string[]>} children
 * @returns {number}
 */
function computeDepth(root, children) {
  const depth = new Map();
  const stack = [[root, false]];
  while (stack.length > 0) {
    const [node, visited] = stack.pop();
    if (visited) {
      const kids = children.get(node) || [];
      if (kids.length === 0) {
        depth.set(node, 1);
      } else {
        let best = 0;
        for (const k of kids) best = Math.max(best, depth.get(k));
        depth.set(node, best + 1);
      }
      continue;
    }
    stack.push([node, true]);
    const kids = children.get(node) || [];
    for (let i = kids.length - 1; i >= 0; i--) {
      stack.push([kids[i], false]);
    }
  }
  return depth.get(root);
}

module.exports = { buildTree, computeDepth };
