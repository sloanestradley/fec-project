/**
 * Cloudflare Pages Function — FEC API proxy
 *
 * Intercepts requests to /api/fec/* and forwards them to the FEC API
 * with the API key injected server-side from an environment secret.
 *
 * The API_KEY secret is set via:
 *   npx wrangler pages secret put API_KEY --project-name fecledger
 *
 * All query params from the original request are forwarded as-is;
 * api_key is appended by this function and never exposed to the browser.
 */
export async function onRequest(context) {
  const { request, env, params } = context;

  // Reconstruct the FEC API path from the catch-all path segments
  const segments = params.path
    ? (Array.isArray(params.path) ? params.path : [params.path])
    : [];
  const fecPath = segments.join('/');

  // Build the FEC API URL, forwarding all original query params
  const originalUrl = new URL(request.url);
  const fecUrl = new URL('https://api.open.fec.gov/v1/' + fecPath);

  for (const [key, value] of originalUrl.searchParams.entries()) {
    fecUrl.searchParams.append(key, value);
  }

  // Inject the API key server-side — never sent to the browser
  fecUrl.searchParams.set('api_key', env.API_KEY);

  const response = await fetch(fecUrl.toString(), {
    method: 'GET',
    headers: { 'User-Agent': 'FECLedger/1.0' },
  });

  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}
