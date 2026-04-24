/**
 * validator.js
 * -------------------------------------------------------------
 * Validates each raw entry per the BFHL specification.
 *
 * Valid format: ^[A-Z]->[A-Z]$ (exactly one uppercase letter on
 * each side of "->"). Anything else is invalid.
 *
 * Invalid cases explicitly handled:
 *   - non-string values
 *   - empty string
 *   - wrong separator (A-B, A=>B, etc.)
 *   - multi-character nodes (AB->C, A->BC)
 *   - non-uppercase letters or numbers (a->b, 1->2)
 *   - missing parent or child (->B, A->)
 *   - self-loops (A->A)
 *   - plain text (hello)
 *
 * Whitespace is trimmed BEFORE validation.
 */

const VALID_EDGE = /^[A-Z]->[A-Z]$/;

/**
 * Validate a single entry.
 * @param {unknown} entry
 * @returns {{ ok: boolean, parent?: string, child?: string, raw: string }}
 */
function validateEntry(entry) {
  // Keep the original-ish form to echo back in invalid_entries.
  // Non-string values are coerced to String for echoing.
  const raw = typeof entry === 'string' ? entry : String(entry);

  if (typeof entry !== 'string') {
    return { ok: false, raw };
  }

  const trimmed = entry.trim();

  if (trimmed.length === 0) {
    return { ok: false, raw };
  }

  if (!VALID_EDGE.test(trimmed)) {
    return { ok: false, raw };
  }

  const [parent, child] = trimmed.split('->');

  // Self-loop is explicitly invalid.
  if (parent === child) {
    return { ok: false, raw };
  }

  return { ok: true, parent, child, raw: `${parent}->${child}` };
}

module.exports = { validateEntry };
