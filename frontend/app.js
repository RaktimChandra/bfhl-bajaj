/**
 * app.js
 * -------------------------------------------------------------
 * BFHL Node Analyzer — frontend logic.
 */

(function () {
  'use strict';

  const VALID_EDGE = /^[A-Z]->[A-Z]$/;

  // -------------------------------------------------------------
  // Configuration — API base URL.
  //
  // Priority:
  //   1. window.BFHL_API_BASE (set via a <script> tag in index.html)
  //   2. localStorage value set by the settings dialog
  //   3. Same-origin (useful when backend serves the frontend)
  // -------------------------------------------------------------
  function getApiBase() {
    if (typeof window.BFHL_API_BASE === 'string' && window.BFHL_API_BASE) {
      return window.BFHL_API_BASE.replace(/\/$/, '');
    }
    try {
      const saved = localStorage.getItem('bfhl_api_base');
      if (saved) return saved.replace(/\/$/, '');
    } catch (_) { /* ignore */ }
    return window.location.origin;
  }
  function setApiBase(url) {
    try { localStorage.setItem('bfhl_api_base', url.replace(/\/$/, '')); }
    catch (_) { /* ignore */ }
  }

  const SPEC_EXAMPLE = [
    'A->B', 'A->C', 'B->D', 'C->E', 'E->F',
    'X->Y', 'Y->Z', 'Z->X',
    'P->Q', 'Q->R',
    'G->H', 'G->H', 'G->I',
    'hello', '1->2', 'A->',
  ];

  // Element refs.
  const $ = id => document.getElementById(id);
  const editor = $('editor');
  const highlight = $('highlight-layer');
  const btnSubmit = $('btn-submit');
  const btnExample = $('btn-example');
  const btnClear = $('btn-clear');
  const btnRetry = $('btn-retry');
  const btnCopyJson = $('btn-copy-json');
  const btnDownloadJson = $('btn-download-json');
  const btnSettings = $('btn-settings');
  const configDialog = $('config-dialog');
  const configInput = $('config-input');
  const configSave = $('config-save');

  const apiDot = $('api-dot');
  const apiStatusText = $('api-status-text');
  const apiEndpointEl = $('api-endpoint');

  const emptyState = $('empty-state');
  const loadingState = $('loading-state');
  const errorState = $('error-state');
  const errorMessage = $('error-message');
  const resultsContent = $('results-content');

  // -------------------------------------------------------------
  // Editor: live validation + syntax highlighting.
  // -------------------------------------------------------------

  function splitEntries(text) {
    // Support both newline and comma separation. Keep empties so the
    // highlight layer stays in sync line-by-line.
    return text.split(/\r?\n/);
  }

  function classifyLine(line) {
    // Return one of: 'empty' | 'valid' | 'invalid'.
    // Commas inside a line: treat each comma-separated chunk as a token.
    const trimmed = line.trim();
    if (trimmed.length === 0) return 'empty';
    // If line has commas, all chunks must be valid for the line to be valid.
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return 'empty';
      const allValid = parts.every(p => VALID_EDGE.test(p) && p[0] !== p[3]);
      return allValid ? 'valid' : 'invalid';
    }
    if (VALID_EDGE.test(trimmed) && trimmed[0] !== trimmed[3]) return 'valid';
    return 'invalid';
  }

  function flattenEntries(text) {
    // What we actually send: split on newlines AND commas, trim, drop empties.
    const out = [];
    for (const line of splitEntries(text)) {
      for (const part of line.split(',')) {
        const t = part.trim();
        if (t.length > 0) out.push(t);
      }
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function updateHighlight() {
    const text = editor.value;
    const lines = text.split(/\r?\n/);
    // Track duplicates across the whole input.
    const seen = new Set();
    const dup = new Set();
    for (const line of lines) {
      for (const part of line.split(',')) {
        const t = part.trim();
        if (VALID_EDGE.test(t) && t[0] !== t[3]) {
          if (seen.has(t)) dup.add(t);
          else seen.add(t);
        }
      }
    }

    const html = lines.map(line => {
      if (line.length === 0) return ''; // preserved newline below
      // Per-chunk coloring so a line with "A->B, wrong" shows both colors.
      const chunks = [];
      let pos = 0;
      const re = /,/g;
      // We split by comma but keep the comma characters for faithful alignment.
      let parts = line.split(',');
      return parts.map((raw, i) => {
        const trimmedLocal = raw.trim();
        let cls = '';
        if (trimmedLocal.length === 0) cls = '';
        else if (VALID_EDGE.test(trimmedLocal) && trimmedLocal[0] !== trimmedLocal[3]) {
          cls = dup.has(trimmedLocal) ? 'tok-dup' : 'tok-valid';
        } else cls = 'tok-invalid';
        const segment = escapeHtml(raw);
        const sep = i < parts.length - 1 ? ',' : '';
        return cls ? `<span class="${cls}">${segment}</span>${sep}` : `${segment}${sep}`;
      }).join('');
    }).join('\n') + '\n'; // trailing newline keeps the pre matching the textarea
    highlight.innerHTML = html;

    // Update stats
    const entries = flattenEntries(text);
    let valid = 0, invalid = 0;
    const stSeen = new Set();
    const stDup = new Set();
    for (const e of entries) {
      if (VALID_EDGE.test(e) && e[0] !== e[3]) {
        if (stSeen.has(e)) stDup.add(e);
        else { stSeen.add(e); valid++; }
      } else {
        invalid++;
      }
    }
    $('stat-total').textContent = String(entries.length);
    $('stat-valid').textContent = String(valid);
    $('stat-invalid').textContent = String(invalid);
    $('stat-dup').textContent = String(stDup.size);
  }

  // Sync scroll between textarea and highlight layer.
  editor.addEventListener('scroll', () => {
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
  });
  editor.addEventListener('input', updateHighlight);

  // Load example
  btnExample.addEventListener('click', () => {
    editor.value = SPEC_EXAMPLE.join('\n');
    updateHighlight();
    toast('Loaded the spec example', 'info');
    editor.focus();
  });

  // Clear
  btnClear.addEventListener('click', () => {
    editor.value = '';
    updateHighlight();
    editor.focus();
  });

  // Ctrl+Enter submit
  editor.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  btnSubmit.addEventListener('click', submit);
  btnRetry.addEventListener('click', submit);

  // -------------------------------------------------------------
  // API health check (cosmetic).
  // -------------------------------------------------------------

  async function checkHealth() {
    const base = getApiBase();
    apiEndpointEl.textContent = `${base}/bfhl`;
    try {
      const res = await fetch(`${base}/health`, { method: 'GET' });
      if (res.ok) {
        apiDot.className = 'status-dot status-ok';
        apiStatusText.textContent = 'online';
      } else throw new Error();
    } catch (_) {
      apiDot.className = 'status-dot status-fail';
      apiStatusText.textContent = 'unreachable';
    }
  }

  // -------------------------------------------------------------
  // Submit & render.
  // -------------------------------------------------------------

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  async function submit() {
    const entries = flattenEntries(editor.value);
    if (entries.length === 0) {
      toast('Enter at least one edge first', 'error');
      return;
    }

    hide(emptyState); hide(errorState); hide(resultsContent);
    show(loadingState);
    btnSubmit.disabled = true;

    const base = getApiBase();
    const url = `${base}/bfhl`;
    const t0 = performance.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: entries }),
      });
      const t1 = performance.now();
      const roundTripMs = t1 - t0;
      const serverTimeHeader = res.headers.get('X-Response-Time');

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
        throw new Error(msg);
      }
      const data = await res.json();

      hide(loadingState);
      renderResults(data, { roundTripMs, serverTimeHeader });
      show(resultsContent);
      scrollToResults();

      // Easter egg: confetti when the spec example is submitted exactly.
      if (arraysEqual(entries, SPEC_EXAMPLE)) confetti();
      toast('Analysis complete', 'success');
    } catch (err) {
      hide(loadingState);
      errorMessage.textContent = err.message || 'The API didn\'t respond as expected.';
      show(errorState);
      toast('Request failed', 'error');
      console.error(err);
    } finally {
      btnSubmit.disabled = false;
    }
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function scrollToResults() {
    document.getElementById('results-section')
      .scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // -------------------------------------------------------------
  // Rendering.
  // -------------------------------------------------------------

  function renderResults(data, perf) {
    // Performance strip
    const serverMs = parseServerTime(perf.serverTimeHeader);
    const roundMs = perf.roundTripMs;
    $('perf-server').textContent = serverMs != null ? `${serverMs.toFixed(1)} ms` : '—';
    $('perf-roundtrip').textContent = `${roundMs.toFixed(0)} ms`;
    $('perf-entries').textContent = String(
      (data.hierarchies || []).reduce((s, h) => s + TreeViz.countNodes(h.tree || {}), 0)
      + (data.invalid_entries || []).length
      + (data.duplicate_edges || []).length
    );
    $('perf-trees').textContent = String(data.summary?.total_trees ?? 0);
    $('perf-cycles').textContent = String(data.summary?.total_cycles ?? 0);
    $('perf-grade-letter').textContent = gradeFor(serverMs != null ? serverMs : roundMs);

    // Summary
    $('sum-trees').textContent = String(data.summary?.total_trees ?? 0);
    $('sum-cycles').textContent = String(data.summary?.total_cycles ?? 0);
    $('sum-largest').textContent = data.summary?.largest_tree_root || '—';

    // Identity
    $('id-user').textContent = data.user_id || '—';
    $('id-email').textContent = data.email_id || '—';
    $('id-roll').textContent = data.college_roll_number || '—';

    // Trees
    renderHierarchies(data.hierarchies || []);

    // Issues
    renderIssues(data.invalid_entries || [], data.duplicate_edges || []);

    // Raw JSON (syntax highlighted)
    $('json-output').innerHTML = highlightJson(JSON.stringify(data, null, 2));
    btnCopyJson.onclick = () => {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        .then(() => toast('JSON copied', 'success'))
        .catch(() => toast('Copy failed', 'error'));
    };
    btnDownloadJson.onclick = () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'bfhl-response.json';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Downloaded', 'success');
    };
  }

  function parseServerTime(h) {
    if (!h) return null;
    const m = /([\d.]+)\s*ms/i.exec(h);
    return m ? parseFloat(m[1]) : null;
  }

  function gradeFor(ms) {
    if (ms == null) return '—';
    if (ms < 50)  return 'A+';
    if (ms < 150) return 'A';
    if (ms < 500) return 'B';
    if (ms < 1500) return 'C';
    return 'D';
  }

  function renderHierarchies(hierarchies) {
    const container = $('trees-container');
    container.innerHTML = '';
    if (hierarchies.length === 0) {
      container.innerHTML = `
        <div class="card" style="padding:32px;text-align:center;color:var(--fg-3);">
          No hierarchies found in the input.
        </div>`;
      return;
    }

    for (const h of hierarchies) {
      const card = document.createElement('div');
      card.className = 'tree-card' + (h.has_cycle ? ' cyclic' : '');

      const header = document.createElement('div');
      header.className = 'tree-card-header';

      const badges = document.createElement('div');
      badges.className = 'tree-badges';
      badges.innerHTML = `
        <span class="badge badge-root">root · ${escapeHtml(h.root)}</span>
        ${h.has_cycle
          ? '<span class="badge badge-cycle">cycle detected</span>'
          : `<span class="badge badge-depth">depth · ${h.depth}</span>
             <span class="badge badge-nodes">${TreeViz.countNodes(h.tree || {})} nodes</span>`}
      `;
      header.appendChild(badges);
      card.appendChild(header);

      const svgWrap = document.createElement('div');
      svgWrap.className = 'tree-svg-wrapper';
      if (h.has_cycle) {
        // For cycles we only know the root; try to recover members from the
        // nodes we saw overall. As a fallback, just render the root.
        const members = cycleMembers(h, hierarchies);
        svgWrap.innerHTML = TreeViz.renderCycle(members);
      } else {
        svgWrap.innerHTML = TreeViz.renderTree(h.tree || {});
      }
      card.appendChild(svgWrap);

      container.appendChild(card);

      // Interactive: hover highlights subtree.
      const svg = svgWrap.querySelector('svg');
      if (svg && !h.has_cycle) {
        wireTreeInteractions(svg, h.tree || {});
      }
    }
  }

  /**
   * Best-effort recovery of cyclic component members so we can draw the ring.
   * We don't have them from the API, so we re-scan the original input.
   */
  function cycleMembers(h /* , all */) {
    const text = editor.value;
    const entries = flattenEntries(text);
    const members = new Set([h.root]);
    const pairs = [];
    for (const e of entries) {
      if (VALID_EDGE.test(e) && e[0] !== e[3]) {
        pairs.push([e[0], e[3]]);
      }
    }
    // Do a flood-fill on the undirected graph starting at the root.
    let changed = true;
    while (changed) {
      changed = false;
      for (const [a, b] of pairs) {
        if (members.has(a) && !members.has(b)) { members.add(b); changed = true; }
        else if (members.has(b) && !members.has(a)) { members.add(a); changed = true; }
      }
    }
    return Array.from(members).sort();
  }

  function wireTreeInteractions(svg, nested) {
    const childrenMap = new Map();
    (function walk(obj) {
      for (const k of Object.keys(obj)) {
        childrenMap.set(k, Object.keys(obj[k]).sort());
        walk(obj[k]);
      }
    })(nested);

    function subtreeOf(name) {
      const set = new Set();
      (function rec(n) {
        if (set.has(n)) return;
        set.add(n);
        for (const c of (childrenMap.get(n) || [])) rec(c);
      })(name);
      return set;
    }

    svg.querySelectorAll('.tree-node').forEach(g => {
      const name = g.getAttribute('data-name');
      g.addEventListener('mouseenter', () => highlightSubtree(svg, subtreeOf(name)));
      g.addEventListener('mouseleave', () => clearHighlights(svg));
    });
  }

  function highlightSubtree(svg, nodeSet) {
    svg.querySelectorAll('.tree-node-circle').forEach(c => {
      const name = c.parentElement.getAttribute('data-name');
      c.classList.toggle('highlighted', nodeSet.has(name));
    });
    svg.querySelectorAll('.tree-edge').forEach(e => {
      const from = e.getAttribute('data-from');
      const to = e.getAttribute('data-to');
      e.classList.toggle('highlighted', nodeSet.has(from) && nodeSet.has(to));
    });
  }
  function clearHighlights(svg) {
    svg.querySelectorAll('.highlighted').forEach(el => el.classList.remove('highlighted'));
  }

  function renderIssues(invalid, dup) {
    const invList = $('invalid-list');
    const dupList = $('dup-list');
    invList.innerHTML = '';
    dupList.innerHTML = '';
    $('invalid-count').textContent = String(invalid.length);
    $('dup-count').textContent = String(dup.length);
    $('issues-count').textContent = String(invalid.length + dup.length);

    if (invalid.length === 0) {
      invList.innerHTML = '<span class="pill-empty">No invalid entries — nice!</span>';
    } else {
      for (const e of invalid) {
        const span = document.createElement('span');
        span.className = 'pill pill-invalid';
        span.textContent = e || '(empty)';
        span.setAttribute('data-tip', reasonFor(e));
        invList.appendChild(span);
      }
    }

    if (dup.length === 0) {
      dupList.innerHTML = '<span class="pill-empty">No duplicates.</span>';
    } else {
      for (const e of dup) {
        const span = document.createElement('span');
        span.className = 'pill pill-dup';
        span.textContent = e;
        span.setAttribute('data-tip', 'Duplicate edge — first occurrence used for tree');
        dupList.appendChild(span);
      }
    }
  }

  function reasonFor(entry) {
    const t = (entry || '').trim();
    if (t === '') return 'Empty or whitespace only';
    if (/^[A-Z]->[A-Z]$/.test(t) && t[0] === t[3]) return 'Self-loop (A->A) — invalid';
    if (!/->/.test(t)) return 'Wrong separator — must be "->"';
    const [p, c] = t.split('->');
    if (!p) return 'Missing parent node';
    if (!c) return 'Missing child node';
    if (p.length > 1 || c.length > 1) return 'Node must be a single uppercase letter';
    if (!/^[A-Z]$/.test(p) || !/^[A-Z]$/.test(c)) return 'Only uppercase A–Z allowed';
    return 'Invalid format';
  }

  function highlightJson(text) {
    return escapeHtml(text)
      .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="key">$1</span>:')
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="str">$1</span>')
      .replace(/:\s*(true|false)\b/g, ': <span class="bool">$1</span>')
      .replace(/:\s*(null)\b/g, ': <span class="null">$1</span>')
      .replace(/:\s*(-?\d+\.?\d*)\b/g, ': <span class="num">$1</span>');
  }

  // -------------------------------------------------------------
  // Tabs
  // -------------------------------------------------------------
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active'); t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-panel') === target);
      });
    });
  });

  // -------------------------------------------------------------
  // Toast
  // -------------------------------------------------------------
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    $('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // -------------------------------------------------------------
  // Settings dialog
  // -------------------------------------------------------------
  btnSettings.addEventListener('click', () => {
    configInput.value = getApiBase();
    if (typeof configDialog.showModal === 'function') configDialog.showModal();
    else configDialog.setAttribute('open', '');
  });
  configSave.addEventListener('click', e => {
    const v = configInput.value.trim();
    if (v) { setApiBase(v); toast('API base URL saved', 'success'); checkHealth(); }
  });

  // -------------------------------------------------------------
  // Confetti easter egg (canvas-based, self-contained)
  // -------------------------------------------------------------
  function confetti() {
    const canvas = $('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#F43F5E'];
    const N = 140;
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: -20,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 4 + 3,
        size: Math.random() * 8 + 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
      });
    }
    const start = performance.now();
    function frame(t) {
      const elapsed = t - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.rot += p.vr;
        p.life = elapsed / 3500;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();
      }
      if (elapsed < 3500) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(frame);
  }

  // -------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------
  updateHighlight();
  checkHealth();
})();
