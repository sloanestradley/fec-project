/**
 * Cloudflare Pages Function — /committee/:id routing
 *
 * Serves committee.html for any /committee/* request while keeping the
 * browser URL intact so committee.html can read the ID from window.location.pathname.
 *
 * See functions/candidate/[[catchall]].js for the full rationale.
 * Netlify uses the _redirects rule instead.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/committee';
  return context.env.ASSETS.fetch(url.toString());
}
