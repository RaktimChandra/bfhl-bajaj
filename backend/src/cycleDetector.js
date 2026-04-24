/**
 * cycleDetector.js
 * -------------------------------------------------------------
 * Iterative DFS cycle detection on a directed graph.
 *
 * Uses white/gray/black coloring to detect back-edges:
 *   WHITE = unvisited
 *   GRAY  = currently on the DFS stack
 *   BLACK = fully processed
 *
 * A cycle exists iff DFS encounters an edge to a GRAY node.
 *
 * Iterative (explicit stack) so that extremely deep graphs cannot
 * blow the JS call stack.
 */

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

/**
 * Detect whether the component containing `startNode` has any cycle.
 * @param {string[]} componentNodes - nodes in this component
 * @param {Map<string, string[]>} children - adjacency (parent -> sorted children)
 * @returns {boolean}
 */
function hasCycle(componentNodes, children) {
  const color = new Map();
  for (const n of componentNodes) color.set(n, WHITE);

  for (const start of componentNodes) {
    if (color.get(start) !== WHITE) continue;

    // Each stack frame: [node, childIndex]
    const stack = [[start, 0]];
    color.set(start, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const [node, idx] = frame;
      const kids = children.get(node) || [];

      if (idx >= kids.length) {
        color.set(node, BLACK);
        stack.pop();
        continue;
      }

      frame[1] = idx + 1;
      const next = kids[idx];
      const c = color.get(next);

      if (c === GRAY) return true;          // back-edge → cycle
      if (c === BLACK) continue;            // already fully explored
      // c === WHITE
      color.set(next, GRAY);
      stack.push([next, 0]);
    }
  }
  return false;
}

module.exports = { hasCycle };
