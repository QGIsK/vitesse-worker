import { getAssetFromKV, serveSinglePageApp } from '@cloudflare/kv-asset-handler';

/**
 * The DEBUG flag will do two things that help during development:
 * 1. we will skip caching on the edge, which makes it easier to
 *    debug.
 * 2. we will return an error message on exception in your Response rather
 *    than the default 404.html page.
 */
const DEBUG = true;

addEventListener('fetch', event => {
  try {
    event.respondWith(handleEvent(event));
  } catch (e) {
    if (DEBUG) {
      return event.respondWith(
        new Response(e.message || e.toString(), {
          status: 500,
        }),
      );
    }
    event.respondWith(new Response('Internal Error', { status: 500 }));
  }
});

async function handleEvent(event) {
  const options = { mapRequestToAsset: serveSinglePageApp };

  try {
    if (DEBUG) {
      // customize caching
      options.cacheControl = {
        bypassCache: true,
      };
    }
    const page = await getAssetFromKV(event, options);

    // allow headers to be altered
    const response = new Response(page.body, page);

    // TODO :: Set require-trusted-types-for 'script'
    const policy =
      "default-src 'self'; script-src 'self'; img-src 'self' https://*; child-src 'none'; style-src 'self'; object-src'none';";

    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Feature-Policy', 'none');
    response.headers.set('Service-Worker-Allowed', '/');
    response.headers.set('Content-Security-Policy', policy);
    response.headers.set('X-Content-Security-Policy', policy);
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

    return response;
  } catch (e) {
    // if an error is thrown try to serve the asset at 404.html
    // Fall back to serving `/index.html` on errors.
    return getAssetFromKV(event, {
      mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/index.html`, req),
    });
  }
}