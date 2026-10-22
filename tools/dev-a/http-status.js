// HTTP status codes: searchable reference of every standard code plus a "which code should I use?" decision helper.
import { el, render, store, copy } from '../../lib/ui.js';

const CLASSES = {
  1: { name: 'Informational', hint: 'Interim responses; the request continues.' },
  2: { name: 'Success', hint: 'The request was received, understood and accepted.' },
  3: { name: 'Redirection', hint: 'Further action is needed to complete the request.' },
  4: { name: 'Client error', hint: 'The request is wrong or cannot be fulfilled as sent.' },
  5: { name: 'Server error', hint: 'The server failed to fulfil a valid request.' },
};

// [code, name, plain-English explanation, when to use]
const CODES = [
  [100, 'Continue', 'The server has received the request headers and the client may go ahead and send the body.', 'Automatically, when a client sends "Expect: 100-continue" before uploading a large body.'],
  [101, 'Switching Protocols', 'The server agrees to switch to the protocol the client asked for via the Upgrade header.', 'WebSocket handshakes and HTTP/1.1 to HTTP/2 (h2c) upgrades.'],
  [102, 'Processing', 'The server has accepted the request and is still working on it; no final response yet.', 'Long-running WebDAV operations (deprecated in modern specs; prefer 202 for async work).'],
  [103, 'Early Hints', 'Preliminary headers, usually Link headers, sent before the final response so the browser can start preloading.', 'When the origin takes a while and you want the browser to preload CSS/JS/fonts in the meantime.'],

  [200, 'OK', 'Everything worked. The response body contains the result.', 'The default for successful GET, and for POST/PUT/PATCH that return the resulting resource.'],
  [201, 'Created', 'A new resource was created as a result of the request.', 'After a POST or PUT that creates something. Include a Location header pointing at the new resource.'],
  [202, 'Accepted', 'The request was accepted for processing but is not finished yet.', 'Queued or background jobs: return a status URL or job id so the client can poll.'],
  [203, 'Non-Authoritative Information', 'Success, but the response was modified by a proxy or comes from a copy, not the origin.', 'Rarely set by applications; transforming proxies use it.'],
  [204, 'No Content', 'Success with nothing to send back.', 'DELETE, or PUT/PATCH when the client does not need the updated resource. The body must be empty.'],
  [205, 'Reset Content', 'Success; the client should reset the document view, e.g. clear the form.', 'Form submissions where the UI should be cleared for another entry. Uncommon.'],
  [206, 'Partial Content', 'Only part of the resource was sent, as requested by a Range header.', 'Resumable downloads and video streaming (byte-range requests).'],
  [207, 'Multi-Status', 'The body contains several status codes, one per sub-operation.', 'WebDAV batch operations. Outside WebDAV, prefer a normal 200 with per-item results in JSON.'],
  [208, 'Already Reported', 'The members of a collection were already listed earlier in this multi-status response.', 'WebDAV only, to avoid repeating bindings.'],
  [226, 'IM Used', 'The response is a delta/instance-manipulation of the resource rather than the whole thing.', 'HTTP delta encoding (RFC 3229). Practically never used.'],

  [300, 'Multiple Choices', 'There is more than one representation; the client should pick one.', 'Agent-driven content negotiation. Rare; most servers just pick a representation themselves.'],
  [301, 'Moved Permanently', 'The resource now lives at the URL in the Location header, for good. Browsers cache it and may change POST to GET.', 'Permanent URL changes for GET resources: old domains, renamed pages, http to https.'],
  [302, 'Found', 'Temporarily at another URL. Browsers commonly change POST to GET when following it.', 'Temporary redirects where method change is acceptable. Prefer 303 or 307 to be explicit.'],
  [303, 'See Other', 'Look at this other URL with a GET request. The original request has been handled.', 'The POST-redirect-GET pattern: after processing a form, send the browser to a result page.'],
  [304, 'Not Modified', 'The cached copy the client has is still valid; no body is sent.', 'Conditional requests (If-None-Match / If-Modified-Since) when the resource is unchanged.'],
  [305, 'Use Proxy', 'The resource must be accessed through the proxy given in Location. Deprecated for security reasons.', 'Never. Browsers ignore it.'],
  [307, 'Temporary Redirect', 'Temporarily at another URL; the client must repeat the request with the same method and body.', 'Temporary redirects of POST/PUT/DELETE where the method must be preserved, e.g. maintenance or A/B routing.'],
  [308, 'Permanent Redirect', 'Permanently at another URL; the client must repeat the request with the same method and body.', 'Permanent API endpoint moves where the method must be preserved.'],

  [400, 'Bad Request', 'The server cannot understand the request: malformed syntax, invalid JSON, bad parameters.', 'The catch-all for a request the server cannot parse or that fails basic validation.'],
  [401, 'Unauthorized', 'Authentication is missing or invalid. Despite the name, this means "not authenticated".', 'No credentials, expired token, bad API key. Include a WWW-Authenticate header.'],
  [402, 'Payment Required', 'Reserved for future use; some APIs use it to mean the account needs to pay or has exceeded a quota.', 'Billing problems in a paid API, if you accept that it is semi-standard.'],
  [403, 'Forbidden', 'The client is identified but is not allowed to do this. Re-authenticating will not help.', 'Permission denied for an authenticated user. Use 404 instead if revealing that the resource exists is a leak.'],
  [404, 'Not Found', 'The resource does not exist at this URL (or the server will not say).', 'Unknown routes and ids, and hiding resources the caller may not know about.'],
  [405, 'Method Not Allowed', 'The URL exists but does not support this HTTP method.', 'E.g. DELETE on a read-only collection. Include an Allow header listing valid methods.'],
  [406, 'Not Acceptable', 'The server cannot produce a representation matching the Accept headers.', 'The client asks for Accept: application/xml and you only serve JSON. Many APIs just ignore Accept and return 200.'],
  [407, 'Proxy Authentication Required', 'Like 401, but the client must authenticate with a proxy first.', 'Set by proxies only.'],
  [408, 'Request Timeout', 'The server gave up waiting for the client to finish sending the request.', 'Idle connections and clients that stall mid-upload. Usually set by the web server, not the app.'],
  [409, 'Conflict', 'The request conflicts with the current state of the resource.', 'Duplicate unique keys, optimistic-locking version mismatches, deleting something still in use.'],
  [410, 'Gone', 'The resource used to exist and was removed permanently; there is no forwarding address.', 'Retired API versions and intentionally deleted content, when you want crawlers and clients to stop asking.'],
  [411, 'Length Required', 'The request needs a Content-Length header and did not have one.', 'Servers that cannot accept chunked uploads. Rare in application code.'],
  [412, 'Precondition Failed', 'A condition in If-Match, If-Unmodified-Since, etc. was not met.', 'Optimistic concurrency with ETags: the client tried to update a stale version.'],
  [413, 'Content Too Large', 'The request body is bigger than the server is willing to accept.', 'Upload limits. Previously named "Payload Too Large".'],
  [414, 'URI Too Long', 'The URL is longer than the server will process.', 'Huge query strings; suggest POST instead.'],
  [415, 'Unsupported Media Type', 'The body is in a format the server does not support (wrong Content-Type).', 'Client sends XML or form data to a JSON-only endpoint, or an unsupported image type.'],
  [416, 'Range Not Satisfiable', 'The Range header asks for bytes outside the resource.', 'A resumable download that asks for an offset past the end of the file.'],
  [417, 'Expectation Failed', 'The server cannot meet the Expect header requirement.', 'Almost only "Expect: 100-continue" on servers that do not support it.'],
  [418, "I'm a teapot", 'An April Fools joke from RFC 2324: the server refuses to brew coffee because it is a teapot.', 'Easter eggs only. Some use it as a playful block response, but 403 or 429 is correct.'],
  [421, 'Misdirected Request', 'The request was sent to a server that cannot produce a response for this combination of scheme and host.', 'HTTP/2 connection reuse hitting a server that does not serve that hostname.'],
  [422, 'Unprocessable Content', 'The request is well-formed but semantically invalid, e.g. validation errors.', 'Field validation failures when the JSON itself parsed fine: missing required fields, invalid email, out-of-range values.'],
  [423, 'Locked', 'The resource is locked.', 'WebDAV locking. For application-level locks, 409 is more common.'],
  [424, 'Failed Dependency', 'The request failed because an earlier request it depended on failed.', 'WebDAV batch operations.'],
  [425, 'Too Early', 'The server will not process a request that might be replayed (TLS 1.3 early data).', 'Only by servers handling TLS 0-RTT.'],
  [426, 'Upgrade Required', 'The client must switch to a different protocol, named in the Upgrade header.', 'Forcing an upgrade to TLS or a newer protocol version.'],
  [428, 'Precondition Required', 'The server requires the request to be conditional (If-Match etc.) to avoid lost updates.', 'APIs that enforce optimistic concurrency and reject unconditional updates.'],
  [429, 'Too Many Requests', 'The client has sent too many requests in a given time (rate limiting).', 'Rate limits and abuse protection. Include Retry-After and ideally RateLimit headers.'],
  [431, 'Request Header Fields Too Large', 'Headers are too big, individually or in total.', 'Oversized cookies. Usually set by the web server.'],
  [451, 'Unavailable For Legal Reasons', 'The resource cannot be served because of a legal demand (censorship, court order, DMCA).', 'Geo-blocking or takedowns required by law. Link to the demand if you can.'],

  [500, 'Internal Server Error', 'Something went wrong on the server and it has no more specific code.', 'Unhandled exceptions. Never leak stack traces in production.'],
  [501, 'Not Implemented', 'The server does not support the functionality needed to fulfil the request (usually the method itself).', 'Unknown HTTP methods, or an endpoint that exists in the spec but is not built yet.'],
  [502, 'Bad Gateway', 'The server, acting as a proxy, got an invalid response from the upstream server.', 'Load balancers and reverse proxies when the backend is down or returns garbage.'],
  [503, 'Service Unavailable', 'The server is temporarily unable to handle the request: overloaded or down for maintenance.', 'Planned maintenance, overload shedding, dependencies down. Include Retry-After.'],
  [504, 'Gateway Timeout', 'The proxy did not get a timely response from the upstream server.', 'Reverse proxies and API gateways when the backend takes too long.'],
  [505, 'HTTP Version Not Supported', 'The server does not support the HTTP version used in the request.', 'Almost never set by applications.'],
  [506, 'Variant Also Negotiates', 'A configuration error in transparent content negotiation.', 'Practically never.'],
  [507, 'Insufficient Storage', 'The server cannot store the representation needed to complete the request.', 'WebDAV servers out of quota; some APIs use it for storage limits.'],
  [508, 'Loop Detected', 'The server detected an infinite loop while processing the request.', 'WebDAV with circular bindings.'],
  [510, 'Not Extended', 'Further extensions to the request are required for the server to fulfil it.', 'Obsolete (RFC 2774).'],
  [511, 'Network Authentication Required', 'The client needs to authenticate to gain network access.', 'Captive portals (hotel and airport Wi-Fi). Set by the network, not your app.'],
].map(([code, name, what, when]) => ({ code, name, what, when, cls: Math.floor(code / 100) }));

// Decision tree. A node is { q, options: [[label, nodeOrCode]] }; a number is a leaf (status code).
const TREE = {
  q: 'What happened to the request?',
  options: [
    ['It succeeded', {
      q: 'What kind of success?',
      options: [
        ['A new resource was created', 201],
        ['Work was queued and will finish later', 202],
        ['It succeeded and there is nothing to return', {
          q: 'Should the client clear its form or view?',
          options: [['No, just empty response', 204], ['Yes, reset the UI', 205]],
        }],
        ['Only a byte range of the resource is returned', 206],
        ['The client already has the current version (conditional request)', 304],
        ['It succeeded with a normal response body', 200],
      ],
    }],
    ['The resource is somewhere else (redirect)', {
      q: 'Is the move permanent?',
      options: [
        ['Permanent', {
          q: 'Must the client repeat a POST/PUT/DELETE with the same method and body?',
          options: [['Yes, keep the method', 308], ['No, it is a GET resource / method may change', 301]],
        }],
        ['Temporary', {
          q: 'What should the client do next?',
          options: [
            ['Repeat the same method and body at the new URL', 307],
            ['Do a GET on another URL (e.g. after a form POST)', 303],
            ['Legacy temporary redirect, method may change', 302],
          ],
        }],
      ],
    }],
    ['The client did something wrong', {
      q: 'Which of these fits best?',
      options: [
        ['Credentials are missing, invalid or expired', 401],
        ['The user is authenticated but not allowed', {
          q: 'Is it acceptable to reveal that the resource exists?',
          options: [['Yes', 403], ['No, hide it', 404]],
        }],
        ['The URL or id does not exist', {
          q: 'Did it exist before and is now permanently removed?',
          options: [['No, it was never there (or unknown)', 404], ['Yes, deliberately removed', 410]],
        }],
        ['The HTTP method is not supported on this URL', 405],
        ['The request body or parameters are invalid', {
          q: 'Is the request well-formed but semantically wrong?',
          options: [
            ['Cannot be parsed at all (bad JSON, bad syntax)', 400],
            ['Parses fine, but fails validation (missing field, bad value)', 422],
            ['Body is in an unsupported format (Content-Type)', 415],
            ['Body is too large', 413],
            ['URL is too long', 414],
          ],
        }],
        ['It conflicts with the current state', {
          q: 'What kind of conflict?',
          options: [
            ['Duplicate, version mismatch, or state does not allow it', 409],
            ['An If-Match / ETag precondition failed', 412],
            ['The client must send a precondition and did not', 428],
          ],
        }],
        ['The client is sending too many requests', 429],
        ['The server cannot produce the requested format (Accept header)', 406],
        ['The client took too long to send the request', 408],
        ['Blocked for legal reasons', 451],
      ],
    }],
    ['The server failed', {
      q: 'Where did it fail?',
      options: [
        ['An upstream service returned an invalid response', 502],
        ['An upstream service timed out', 504],
        ['The server is overloaded or down for maintenance', 503],
        ['The feature or method is not implemented', 501],
        ['Out of storage', 507],
        ['An unexpected error', 500],
      ],
    }],
  ],
};

export default function (root) {
  const s = store('http-status');
  const search = el('input', { class: 'input grow', placeholder: 'Search code, name or words… e.g. 404, timeout, redirect', value: s.get('q', ''), style: { minWidth: '220px' } });
  const clsSel = el('select', { class: 'select' }, el('option', { value: '' }, 'All classes'), Object.entries(CLASSES).map(([k, v]) => el('option', { value: k }, `${k}xx ${v.name}`)));
  clsSel.value = s.get('cls', '');
  const list = el('div', { class: 'col', style: { gap: '6px' } });
  const count = el('span', { class: 'muted small' });
  const helper = el('div', {});
  const cards = new Map();

  function card(c) {
    const badgeCls = c.cls === 2 ? 'ok' : c.cls === 4 ? 'warn' : c.cls === 5 ? 'danger' : '';
    const node = el('div', { class: 'panel', style: { padding: '10px 12px' } },
      el('div', { class: 'row', style: { margin: 0 } },
        el('span', { class: 'badge ' + badgeCls, style: { fontWeight: 700, minWidth: '46px', textAlign: 'center' } }, c.code),
        el('b', {}, c.name),
        el('span', { class: 'muted small' }, CLASSES[c.cls].name),
        el('span', { class: 'grow' }),
        el('button', { class: 'btn small ghost', onclick: () => copy(`${c.code} ${c.name}`) }, 'Copy')),
      el('div', { class: 'small', style: { marginTop: '4px' } }, c.what),
      el('div', { class: 'small muted', style: { marginTop: '2px' } }, el('b', {}, 'When to use: '), c.when));
    cards.set(c.code, node);
    return node;
  }
  for (const c of CODES) card(c);

  function draw() {
    const q = search.value.trim().toLowerCase();
    const cls = clsSel.value;
    s.set('q', search.value); s.set('cls', cls);
    const words = q.split(/\s+/).filter(Boolean);
    const hits = CODES.filter(c => {
      if (cls && String(c.cls) !== cls) return false;
      if (!words.length) return true;
      const hay = `${c.code} ${c.name} ${c.what} ${c.when} ${CLASSES[c.cls].name}`.toLowerCase();
      return words.every(w => hay.includes(w) || (/^\d{1,3}$/.test(w) && String(c.code).startsWith(w)));
    });
    count.textContent = `${hits.length} of ${CODES.length} codes`;
    render(list, hits.length ? hits.map(c => cards.get(c.code)) : el('div', { class: 'muted' }, 'No code matches that search.'));
  }

  // ---- decision helper ----
  const path = [];
  function drawHelper() {
    let node = TREE;
    for (const i of path) node = node.options[i][1];
    const crumbs = [];
    let n = TREE;
    path.forEach((i, depth) => {
      crumbs.push(el('button', { class: 'btn small ghost', onclick: () => { path.length = depth; drawHelper(); } }, n.options[i][0]));
      n = n.options[i][1];
    });
    const header = el('div', { class: 'row', style: { margin: '0 0 6px' } },
      el('b', {}, 'Which code should I use?'),
      el('span', { class: 'grow' }),
      path.length ? el('button', { class: 'btn small', onclick: () => { path.length = 0; drawHelper(); } }, 'Start over') : null);
    if (typeof node === 'number') {
      const c = CODES.find(x => x.code === node);
      render(helper, header, crumbs.length ? el('div', { class: 'row small', style: { margin: '0 0 8px' } }, crumbs) : null,
        el('div', { class: 'row' }, el('span', { class: 'big' }, `${c.code} ${c.name}`)),
        el('div', { class: 'small' }, c.what),
        el('div', { class: 'small muted' }, el('b', {}, 'When to use: '), c.when),
        el('div', { class: 'row' },
          el('button', { class: 'btn small primary', onclick: () => copy(`${c.code} ${c.name}`) }, 'Copy'),
          el('button', { class: 'btn small', onclick: () => { search.value = String(c.code); clsSel.value = ''; draw(); cards.get(c.code).scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 'Show in list'),
          el('button', { class: 'btn small ghost', onclick: () => { path.pop(); drawHelper(); } }, 'Back')));
      return;
    }
    render(helper, header, crumbs.length ? el('div', { class: 'row small', style: { margin: '0 0 8px' } }, crumbs) : null,
      el('div', { class: 'small', style: { marginBottom: '6px' } }, node.q),
      el('div', { class: 'col', style: { gap: '4px' } },
        node.options.map(([label, next], i) => el('button', { class: 'btn', style: { textAlign: 'left' }, onclick: () => { path.push(i); drawHelper(); } },
          label, typeof next === 'number' ? el('span', { class: 'muted small' }, `  → ${next}`) : ''))),
      path.length ? el('div', { class: 'row' }, el('button', { class: 'btn small ghost', onclick: () => { path.pop(); drawHelper(); } }, 'Back')) : null);
  }

  search.addEventListener('input', draw);
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; draw(); } });
  clsSel.addEventListener('change', draw);

  render(root,
    el('div', { class: 'grid2', style: { alignItems: 'start' } },
      el('div', {},
        el('div', { class: 'row' }, search, clsSel),
        el('div', { class: 'row', style: { margin: '0 0 8px' } }, count,
          el('span', { class: 'muted small' }, Object.entries(CLASSES).map(([k, v]) => ` · ${k}xx ${v.hint}`).join('').slice(3))),
        list),
      el('div', { class: 'panel', style: { position: 'sticky', top: '64px' } }, helper)));
  draw();
  drawHelper();
}
