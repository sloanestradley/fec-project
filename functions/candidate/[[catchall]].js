/**
 * Cloudflare Pages Function — /candidate/:id routing
 *
 * Serves candidate.html for any /candidate/* request while keeping the
 * browser URL intact so candidate.html can read the ID from window.location.pathname.
 *
 * Why this exists: Cloudflare's Pretty URL feature redirects /foo.html → /foo,
 * so _redirects rules that rewrite /candidate/:id → /candidate.html create a
 * redirect loop. Using ASSETS.fetch with the clean URL (/candidate, no extension)
 * bypasses the loop — Cloudflare serves candidate.html natively at /candidate.
 *
 * Netlify uses the _redirects rule instead (it handles 200 rewrites correctly).
 * This Function takes precedence over _redirects on Cloudflare Pages.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/candidate';
  return context.env.ASSETS.fetch(url.toString());
}
