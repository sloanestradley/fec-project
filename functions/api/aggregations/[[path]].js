/**
 * Cloudflare Pages Function — pre-computed aggregations proxy
 *
 * Serves JSON blobs from the AGGREGATIONS KV namespace (populated nightly by
 * scripts/precompute-aggregations.js via GitHub Actions). Routes:
 *
 *   GET /api/aggregations/top-contributors?committee_id=X&cycle=Y
 *     → top individual donors to committee X in cycle Y
 *   GET /api/aggregations/top-committees?committee_id=X&cycle=Y
 *     → top committee contributors to committee X in cycle Y (from pas2)
 *
 *   Both routes:
 *     → { results: [...], source: 'bulk' }   (KV hit)
 *     → { results: null,  source: 'api'  }   (KV miss — client falls back
 *                                              to the live FEC API)
 *
 * The miss response is 200 (not 404) because the client branches on the
 * response body, not status code. 400 is reserved for malformed requests.
 */
export async function onRequest(context) {
  const { request, env, params } = context;

  const segments = params.path
    ? (Array.isArray(params.path) ? params.path : [params.path])
    : [];
  const route = segments.join('/');

  const url = new URL(request.url);

  // Both routes share the same query params and response shape — the only
  // difference is the KV key prefix.
  const KV_PREFIX = {
    'top-contributors': 'top_contributors',
    'top-committees':   'top_committees',
  };

  if (KV_PREFIX[route]) {
    const committeeId = url.searchParams.get('committee_id');
    const cycle       = url.searchParams.get('cycle');

    if (!committeeId || !/^C\d{8}$/.test(committeeId)) {
      return jsonResponse({ error: 'invalid or missing committee_id' }, 400);
    }
    if (!cycle || !/^\d{4}$/.test(cycle)) {
      return jsonResponse({ error: 'invalid or missing cycle' }, 400);
    }

    const key = `${KV_PREFIX[route]}:${committeeId}:${cycle}`;
    const results = await env.AGGREGATIONS.get(key, { type: 'json' });

    if (results) {
      return jsonResponse({ results, source: 'bulk' });
    }
    return jsonResponse({ results: null, source: 'api' });
  }

  return jsonResponse({ error: 'unknown aggregation route' }, 404);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
