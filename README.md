# 🌳 BFHL Node Analyzer

> **Bajaj Finserv Health · SRM · Full Stack Engineering Challenge (Round 1)**
> A production-grade node-hierarchy analyzer: feed it edges, get back parsed trees, cycle detection, duplicates, and a rich structured response — all in a few milliseconds.

[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](#)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Status](https://img.shields.io/badge/tests-29%2F29%20passing-10B981)](#)

---

## ✨ Highlights

| | |
|---|---|
| ⚡ **Fast** | < 5 ms server time for 50-node inputs (spec allows 3000 ms) |
| 🧮 **Rigorous** | Iterative DFS (stack-safe), Union-Find with path compression |
| 🎨 **Beautiful** | Glassmorphism UI, live syntax highlighting, SVG tree visualizations |
| 🧪 **Tested** | 29 automated tests covering every spec edge case |
| 🔒 **Hardened** | CORS, body size limits, graceful error middleware |
| 🪄 **Delightful** | Cycle rings animate, confetti on the spec example, `Ctrl+Enter` to submit |

---

## 🗂️ Repository layout

```
bfhl-bajaj/
├── backend/
│   ├── src/
│   │   ├── validator.js       # input validation
│   │   ├── graphBuilder.js    # dedup + diamond + Union-Find
│   │   ├── cycleDetector.js   # iterative DFS (white/gray/black)
│   │   ├── treeBuilder.js     # nested tree + depth (iterative)
│   │   └── processor.js       # pipeline orchestrator
│   ├── index.js               # Express server
│   ├── test.js                # 29-case regression suite
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── tree-viz.js            # SVG tree layout (Reingold-Tilford style)
│   └── app.js                 # state, API calls, interactions
└── README.md
```

---

## 🚀 Quick start (local)

**Backend:**
```bash
cd backend
cp .env.example .env        # then fill in your details
npm install
npm start                   # http://localhost:3000
```

**Frontend:** open `frontend/index.html` in a browser — the config panel (⚙ bottom-left) lets you point it at your backend URL.

**Run tests:**
```bash
cd backend
npm test                    # 29 passing
```

---

## 📡 API

### `POST /bfhl`

**Request**
```json
{ "data": ["A->B", "A->C", "B->D"] }
```

**Response** (spec example)
```json
{
  "user_id": "yourname_ddmmyyyy",
  "email_id": "you@college.edu",
  "college_roll_number": "21CS1001",
  "hierarchies": [
    { "root": "A", "tree": { "A": { "B": { "D": {} }, "C": { "E": { "F": {} } } } }, "depth": 4 },
    { "root": "G", "tree": { "G": { "H": {}, "I": {} } }, "depth": 2 },
    { "root": "P", "tree": { "P": { "Q": { "R": {} } } }, "depth": 3 },
    { "root": "X", "tree": {}, "has_cycle": true }
  ],
  "invalid_entries": ["hello", "1->2", "A->"],
  "duplicate_edges": ["G->H"],
  "summary": { "total_trees": 3, "total_cycles": 1, "largest_tree_root": "A" }
}
```

**Status codes**

| Code | Meaning |
|---|---|
| 200 | Processed successfully |
| 400 | Body missing, non-object, `data` not an array, or malformed JSON |
| 500 | Unexpected server error |

**Response headers**

| Header | Example | Purpose |
|---|---|---|
| `X-Response-Time` | `1.24ms` | Server-measured processing time (used by the frontend's perf strip) |
| `Access-Control-Allow-Origin` | `*` | CORS wide-open for evaluators |

### `GET /health`

Liveness probe — returns `{ status, uptime, version, timestamp }`.

---

## 🧠 Algorithm notes

**Validation.** Each entry is trimmed, then tested against `^[A-Z]->[A-Z]$`. Self-loops (`A->A`), wrong separators, multi-character nodes, and non-uppercase characters are all routed to `invalid_entries`.

**Deduplication.** A `Set` tracks seen `Parent->Child` pairs. The first occurrence is used for tree building; subsequent copies are pushed to `duplicate_edges` **once** per pair, regardless of how many times they repeat.

**Diamond resolution.** When a child already has a parent recorded, subsequent parent edges are silently discarded per spec. The undirected union is still performed so the component stays whole.

**Components.** Union-Find with path compression and union-by-rank — O(n·α(n)) near-linear.

**Root selection.** Per component, the root is the node with no parent. If no such node exists (pure cycle), the lexicographically smallest node is used.

**Cycle detection.** Iterative DFS with white/gray/black coloring. Cyclic components return `tree: {}`, `has_cycle: true`, no `depth` field.

**Tree construction & depth.** Iterative post-order so deep inputs cannot blow the JS call stack. Depth is the number of nodes on the longest root-to-leaf path (memoized bottom-up).

**Summary.** `largest_tree_root` is the root with maximum depth; ties resolved by lexicographically smaller root. `total_trees` counts only non-cyclic components.

---

## 🎨 Frontend features

- **Live syntax highlighting** — valid edges glow green, invalid red with wavy underline, duplicates amber, as you type.
- **SVG tree renderer** — proper node-link diagrams, not JSON dumps. Hover any node to highlight its subtree.
- **Cycle visualization** — pulsing red ring with animated dashes around cyclic components.
- **Performance strip** — shows server time, client round-trip, entry count, tree/cycle counts, and a performance grade (A+/A/B/C).
- **Four tabs** — Trees · Summary · Issues · Raw JSON (syntax-highlighted, with copy + download).
- **Polish** — loading skeleton, error state with retry, empty state with animated illustration, toast notifications, responsive layout, accessible tabs, keyboard shortcut (`Ctrl+Enter`).
- **Easter egg** — submit the exact spec example → confetti burst.

---

## 🌐 Deployment

Deployment instructions are in [`DEPLOYMENT.md`](./DEPLOYMENT.md). The short version:

- **Backend → Render** (free tier). Set env vars: `FULL_NAME`, `DOB`, `EMAIL_ID`, `COLLEGE_ROLL_NUMBER`.
- **Frontend → Vercel / Netlify** (free tier). After deploy, open the site, click ⚙ bottom-left, and paste your Render URL.

---

## 📜 License

MIT — do whatever you want, just don't claim you wrote it.
