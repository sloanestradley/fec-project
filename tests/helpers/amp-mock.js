/**
 * Amplitude mock helpers for Playwright tests.
 *
 * Strategy:
 * 1. addInitScript injects window.sessionReplay BEFORE any page script runs,
 *    so main.js doesn't throw on `window.sessionReplay.plugin(...)`.
 * 2. All cdn.amplitude.com requests are blocked — the real SDK never loads,
 *    so window.amplitude._q (the snippet's queue) never drains.
 * 3. All amplitude.track() calls queue up in _q, which we can inspect.
 *
 * Queue item shape: { name: 'track', args: ['Event Name', { ...props }] }
 */

/** Block Amplitude CDN and stub sessionReplay so main.js doesn't crash. */
export async function mockAmplitude(page) {
  await page.addInitScript(() => {
    window.sessionReplay = { plugin: () => ({}) };
  });
  await page.route('**cdn.amplitude.com**', route =>
    route.fulfill({ body: '', contentType: 'application/javascript' })
  );
}

/** Return all items queued in window.amplitude._q. */
export async function getAmplitudeQueue(page) {
  return page.evaluate(() => {
    const q = (window.amplitude && window.amplitude._q) || [];
    return q.map(e => ({ name: e.name, args: e.args || [] }));
  });
}

/**
 * Return the first amplitude.track() call matching eventName, or undefined.
 * Searches window.amplitude._q for { name: 'track', args: [eventName, ...] }.
 */
export async function findTrackEvent(page, eventName) {
  const queue = await getAmplitudeQueue(page);
  return queue.find(e => e.name === 'track' && e.args[0] === eventName);
}
