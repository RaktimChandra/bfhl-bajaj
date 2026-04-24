/**
 * index.js
 * -------------------------------------------------------------
 * Bajaj Finserv Health — BFHL Node Hierarchy Analyzer API
 *
 * Endpoints:
 *   POST /bfhl   — main analyzer
 *   GET  /health — liveness probe
 *   GET  /       — friendly landing page (JSON)
 *
 * Hardening:
 *   - CORS wide open (spec says evaluator calls from a different origin)
 *   - JSON body size limited to 1mb
 *   - X-Response-Time header on every response
 *   - Graceful error middleware
 *   - Request logging
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { processData } = require('./src/processor');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = '1.0.0';

/* -------------------------------------------------------------- */
/* Middleware                                                      */
/* -------------------------------------------------------------- */

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.options('*', cors());
app.use(express.json({ limit: '1mb' }));

// Per-request timing + logging.
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const size =
      req.body && Array.isArray(req.body.data) ? req.body.data.length : '-';
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ` +
      `status=${res.statusCode} entries=${size} time=${elapsedMs.toFixed(2)}ms`
    );
  });
  res.locals.__start = start;
  next();
});

/* -------------------------------------------------------------- */
/* Identity (from env, never hardcoded per spec)                   */
/* -------------------------------------------------------------- */

function buildIdentity() {
  const fullName = (process.env.FULL_NAME || 'John Doe')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const dob = (process.env.DOB || '17091999').trim();
  const email = (process.env.EMAIL_ID || 'john.doe@college.edu').trim();
  const roll = (process.env.COLLEGE_ROLL_NUMBER || '21CS1001').trim();
  return {
    user_id: `${fullName}_${dob}`,
    email_id: email,
    college_roll_number: roll,
  };
}

/* -------------------------------------------------------------- */
/* Routes                                                          */
/* -------------------------------------------------------------- */

app.get('/', (_req, res) => {
  res.json({
    name: 'BFHL Node Hierarchy Analyzer',
    version: VERSION,
    usage: 'POST /bfhl with { "data": ["A->B", ...] }',
    health: '/health',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: VERSION,
    timestamp: new Date().toISOString(),
  });
});

app.post('/bfhl', (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        error: 'Request body must be a JSON object with a "data" array.',
      });
    }
    const { data } = body;
    if (!Array.isArray(data)) {
      return res.status(400).json({
        error: '"data" must be an array of strings.',
      });
    }

    const identity = buildIdentity();
    const result = processData(data);

    const elapsedMs =
      Number(process.hrtime.bigint() - res.locals.__start) / 1e6;
    res.setHeader('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);
    res.setHeader('Access-Control-Expose-Headers', 'X-Response-Time');

    return res.status(200).json({ ...identity, ...result });
  } catch (err) {
    console.error('[/bfhl] Unhandled error:', err);
    return res.status(500).json({
      error: 'Internal server error while processing data.',
    });
  }
});

// JSON-parse failures and other thrown errors.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body.' });
  }
  console.error('[error middleware]', err);
  return res.status(500).json({ error: 'Internal server error.' });
});

/* -------------------------------------------------------------- */

app.listen(PORT, () => {
  console.log(`BFHL API v${VERSION} listening on :${PORT}`);
});
