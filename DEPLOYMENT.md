# 🚀 Deployment Guide

This walks you through deploying the backend to **Render** and the frontend to **Vercel** — both free tiers, no credit card required.

You can swap in Railway, Netlify, Fly.io, or anything else; the steps are essentially identical.

---

## Step 1 — Push to GitHub

From the project root:

```bash
git init
git add .
git commit -m "BFHL Round 1 submission"
git branch -M main
git remote add origin https://github.com/<your-username>/bfhl-bajaj.git
git push -u origin main
```

Make the repo **public** (submission form requires it).

---

## Step 2 — Deploy the backend (Render)

1. Sign in at **https://render.com** with your GitHub account.
2. Click **New +** → **Web Service**.
3. Connect your `bfhl-bajaj` repository.
4. Fill in the form:

   | Field | Value |
   |---|---|
   | Name | `bfhl-<yourname>` |
   | Region | Closest to you (Singapore works well for India) |
   | Branch | `main` |
   | Root Directory | `backend` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

5. **Environment variables** — scroll to the **Environment** section and add:

   | Key | Example |
   |---|---|
   | `FULL_NAME` | `Your Full Name` |
   | `DOB` | `17091999` (ddmmyyyy, no separators) |
   | `EMAIL_ID` | `you@college.edu` |
   | `COLLEGE_ROLL_NUMBER` | `RA2111003010XXX` |

6. Click **Create Web Service**.
7. Wait for the build. Once live you'll see a URL like `https://bfhl-<yourname>.onrender.com`.
8. Verify:
   ```bash
   curl https://bfhl-<yourname>.onrender.com/health
   curl -X POST https://bfhl-<yourname>.onrender.com/bfhl \
     -H "Content-Type: application/json" \
     -d '{"data":["A->B","B->C"]}'
   ```

> ⏱️ Render's free tier spins down after ~15 min of inactivity. The first request after a cold start can take ~30 s. If this concerns you for evaluation, hit the `/health` endpoint a few times right before you submit the form.

---

## Step 3 — Deploy the frontend (Vercel)

1. Sign in at **https://vercel.com** with your GitHub account.
2. Click **Add New...** → **Project**.
3. Import your `bfhl-bajaj` repository.
4. Configure:

   | Field | Value |
   |---|---|
   | Framework Preset | `Other` |
   | Root Directory | `frontend` |
   | Build Command | *(leave blank)* |
   | Output Directory | `./` |

5. Click **Deploy**.
6. You'll get a URL like `https://bfhl-<yourname>.vercel.app`.

**Point the frontend at your backend.** Two options:

### Option A — Inline script (recommended, zero-config for evaluators)

Edit `frontend/index.html` and add this **just before** the closing `</body>` tag, before the other `<script>` tags:

```html
<script>window.BFHL_API_BASE = "https://bfhl-<yourname>.onrender.com";</script>
```

Commit, push, Vercel auto-redeploys.

### Option B — Runtime config

Open your deployed frontend, click the **⚙** button bottom-left, paste your backend URL, hit Save. This persists in `localStorage` but only for your browser — so use Option A for submission.

---

## Step 4 — Verify everything

Open your Vercel URL in an incognito window. You should see:

- ✅ "Bajaj Finserv Health · Round 1 · SRM" badge at the top
- ✅ The API status indicator at the top right says **online** with a green dot
- ✅ Click **Load Example**, then **Analyze** — you should see four hierarchies (A, G, P, X), cycle detected on X, `total_trees: 3`, `total_cycles: 1`, `largest_tree_root: A`
- ✅ Confetti animation when you submit the exact spec example 🎉

---

## Step 5 — Submit the form

The submission form asks for:

| Field | Where to get it |
|---|---|
| Backend API Base URL | Render URL — **no trailing slash, no `/bfhl`** |
| Frontend URL | Vercel URL |
| GitHub Repository URL | Your public repo |

Double-check the confirmation box:
- ☑ Frontend URL loads correctly
- ☑ Backend API responds to POST `/bfhl`
- ☑ CORS is enabled
- ☑ Repo is public
- ☑ This is your own work

---

## Troubleshooting

**Backend says 502 on Render.** Check the Render logs tab; common causes: wrong `Root Directory` (must be `backend`), missing `package.json`, or Node version mismatch (you can set `NODE_VERSION=18` in env vars if needed).

**Frontend can't reach backend (CORS error).** The backend already allows all origins. If you see CORS errors, you're probably hitting an old deployment — do a hard refresh (Ctrl+Shift+R).

**Render free tier is sleeping.** Ping `/health` a few times before submitting, or consider upgrading to the $7/mo tier to keep it always-on during evaluation.

**Frontend points at wrong backend.** Check step 3: either the inline `window.BFHL_API_BASE` script in `index.html`, or click ⚙ on the live site and set it.
