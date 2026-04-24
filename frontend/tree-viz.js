/**
 * tree-viz.js
 * -------------------------------------------------------------
 * Renders a hierarchy object as an SVG node-link diagram.
 *
 * Layout: a compact tidy-tree. Subtree widths are computed
 * bottom-up from leaves (each leaf reserves one horizontal slot)
 * then nodes are placed at the midpoint of their children.
 *
 * Also renders cyclic components: since we don't get the tree
 * shape for a cycle (tree is {}), we pull the node list from a
 * separate `members` argument and lay them out in a ring.
 */

(function (global) {
  'use strict';

  const NODE_RADIUS = 22;
  const LEVEL_HEIGHT = 84;
  const LEAF_WIDTH = 68;
  const PAD = 24;

  /**
   * Convert a nested hierarchy object (e.g. { A: { B: {}, C: { D: {} } } })
   * into a layout tree with computed positions.
   */
  function layoutTree(nested) {
    const rootKey = Object.keys(nested)[0];
    if (!rootKey) return null;

    // Build node tree.
    function build(name, obj) {
      const children = Object.keys(obj)
        .sort()
        .map(k => build(k, obj[k]));
      return { name, children, x: 0, y: 0, width: 0 };
    }
    const root = build(rootKey, nested[rootKey]);

    // First pass: compute subtree width (in leaf units).
    function widthPass(node) {
      if (node.children.length === 0) {
        node.width = 1;
        return 1;
      }
      let w = 0;
      for (const c of node.children) w += widthPass(c);
      node.width = w;
      return w;
    }
    widthPass(root);

    // Second pass: assign x at the midpoint of children, y per depth.
    function placePass(node, depth, xOffset) {
      node.y = PAD + depth * LEVEL_HEIGHT;
      if (node.children.length === 0) {
        node.x = PAD + xOffset * LEAF_WIDTH + LEAF_WIDTH / 2;
        return;
      }
      let cursor = xOffset;
      for (const c of node.children) {
        placePass(c, depth + 1, cursor);
        cursor += c.width;
      }
      const first = node.children[0];
      const last = node.children[node.children.length - 1];
      node.x = (first.x + last.x) / 2;
    }
    placePass(root, 0, 0);

    return root;
  }

  function collectNodes(root) {
    const list = [];
    (function walk(n) {
      list.push(n);
      n.children.forEach(walk);
    })(root);
    return list;
  }

  function collectEdges(root) {
    const list = [];
    (function walk(n) {
      for (const c of n.children) {
        list.push({ from: n, to: c });
        walk(c);
      }
    })(root);
    return list;
  }

  function maxDepth(root) {
    let d = 0;
    (function walk(n, depth) {
      if (depth > d) d = depth;
      n.children.forEach(ch => walk(ch, depth + 1));
    })(root, 0);
    return d;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /**
   * Render a non-cyclic hierarchy.
   * @param {object} nested   e.g. { A: { B: {}, C: {} } }
   * @returns {string} SVG markup
   */
  function renderTree(nested) {
    const root = layoutTree(nested);
    if (!root) return '';

    const nodes = collectNodes(root);
    const edges = collectEdges(root);

    const leafCount = root.width;
    const depth = maxDepth(root);

    const width = Math.max(260, PAD * 2 + leafCount * LEAF_WIDTH);
    const height = PAD * 2 + (depth + 1) * LEVEL_HEIGHT - LEVEL_HEIGHT / 2;

    const edgePaths = edges.map(e => {
      const mid = (e.from.y + e.to.y) / 2;
      return `<path class="tree-edge" data-from="${e.from.name}" data-to="${e.to.name}" d="M ${e.from.x} ${e.from.y + NODE_RADIUS} C ${e.from.x} ${mid} ${e.to.x} ${mid} ${e.to.x} ${e.to.y - NODE_RADIUS}" />`;
    }).join('');

    const nodeMarkup = nodes.map(n => (
      `<g class="tree-node" data-name="${escapeHtml(n.name)}" transform="translate(${n.x} ${n.y})">
         <circle class="tree-node-circle" r="${NODE_RADIUS}" />
         <text class="tree-node-label">${escapeHtml(n.name)}</text>
       </g>`
    )).join('');

    return (
      `<svg class="tree-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
         <g class="edges">${edgePaths}</g>
         <g class="nodes">${nodeMarkup}</g>
       </svg>`
    );
  }

  /**
   * Render a cyclic component. We don't have the tree shape (tree is {}),
   * so we arrange the members around a circle and connect them in a ring
   * to visually convey "cycle". This is illustrative; the real edges may
   * differ but the API contract only guarantees the cycle flag.
   */
  function renderCycle(members) {
    const n = members.length;
    if (n === 0) return '';
    const R = Math.max(60, 22 + n * 14);
    const size = (R + NODE_RADIUS + PAD) * 2;
    const cx = size / 2;
    const cy = size / 2;

    const positions = members.map((name, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { name, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
    });

    const edges = positions.map((p, i) => {
      const q = positions[(i + 1) % n];
      return `<path class="tree-edge cycle-edge" d="M ${p.x} ${p.y} L ${q.x} ${q.y}" />`;
    }).join('');

    const nodes = positions.map(p => (
      `<g class="tree-node" data-name="${escapeHtml(p.name)}" transform="translate(${p.x} ${p.y})">
         <circle class="tree-node-circle cycle-node" r="${NODE_RADIUS}" />
         <text class="tree-node-label">${escapeHtml(p.name)}</text>
       </g>`
    )).join('');

    return (
      `<svg class="tree-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
         <g class="edges">${edges}</g>
         <g class="nodes">${nodes}</g>
       </svg>`
    );
  }

  /** Count nodes in a nested hierarchy. */
  function countNodes(nested) {
    let n = 0;
    (function walk(obj) {
      for (const k of Object.keys(obj)) {
        n++;
        walk(obj[k]);
      }
    })(nested);
    return n;
  }

  global.TreeViz = { renderTree, renderCycle, countNodes };
})(window);
