/**
 * js/data/all_decades.js  (live version)
 * ----------------------------------------
 * Replaces the static DECADE_DB constant with a live data layer that fetches
 * from the Flask API.  The rest of the app (decade.js, comparison.js, etc.)
 * continues to work unchanged because the public interface is identical.
 *
 * Public API
 * ----------
 *   DECADE_DB                    – cache object, same shape as before
 *   getDecadeData(decade)        – returns Promise<decadeObject>
 *   prefetchDecade(decade)       – fire-and-forget pre-warm
 *
 * Configuration
 * -------------
 *   Change API_BASE if your Flask server runs on a different port/host.
 */

const API_BASE = 'http://localhost:5050';
//const API_BASE = 'http://localhost:5000';

// In-memory cache  →  avoids redundant network requests when the user
// slides back to a decade they have already visited.
const DECADE_DB = {};

/**
 * Fetch one decade from the API and store it in DECADE_DB.
 * Returns a Promise that resolves to the decade object.
 *
 * If the data is already cached the Promise resolves immediately.
 */
async function getDecadeData(decade) {
  if (DECADE_DB[decade]) return DECADE_DB[decade];

  const response = await fetch(`${API_BASE}/api/decade/${decade}`);
  if (!response.ok) {
    throw new Error(`API error ${response.status} for decade ${decade}`);
  }

  const data = await response.json();
  DECADE_DB[decade] = data;
  return data;
}

/**
 * Fire-and-forget pre-fetch. Call this when the user hovers over or
 * approaches a decade tile so the data is ready before they click.
 */
function prefetchDecade(decade) {
  getDecadeData(decade).catch(() => {/* silently ignore pre-fetch errors */});
}
