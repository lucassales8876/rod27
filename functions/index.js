// Cloudflare Pages Function: deny the public project root.
// Direct links to login pages remain available.
export function onRequest() {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow, noarchive'
    }
  });
}
