const https = require('https');
const { URL } = require('url');

// Web search for Portico. Read-only, no API key required by default.
//
// Engine reality (tested 2026-07-21): free search endpoints are hostile to automation.
// DuckDuckGo's HTML endpoint works for occasional queries but serves an "anomaly
// challenge" page under rapid repeated use; public SearXNG instances and Mojeek block
// or captcha outright. So: try engines in order and fall through on failure, ending at
// Wikipedia which is a documented API and always answers.

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MAX_BYTES = 2 * 1024 * 1024;
let lastSearchAt = 0;

// Addresses that are never a search result: this machine, the local network, the
// link-local range cloud providers put their metadata service on.
//
// This matters because the URLs fetched here are not chosen by the user. They come
// from search engine results, and the page that comes back is read into the model's
// context. Without this, a result pointing at 127.0.0.1:8033 would pull the engine's
// own responses, and one pointing at 192.168.1.1 would read the router's admin page
// and summarise it. Redirects are checked too — the recursion re-enters here — so an
// external site cannot bounce the fetch inward.
const PRIVATE_V4 = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];
function isInternalAddress(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '::1' || h === '::' ) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true;       // unique-local IPv6
  if (/^fe80:/i.test(h)) return true;                   // link-local IPv6
  if (/^::ffff:/i.test(h)) return isInternalAddress(h.replace(/^::ffff:/i, ''));
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return PRIVATE_V4.some((re) => re.test(h));
  return false;
}

function httpGet(rawUrl, { headers = {}, timeout = 15000, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    let u;
    try { u = new URL(rawUrl); } catch { return reject(new Error('Bad URL')); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return reject(new Error('Unsupported protocol'));
    if (isInternalAddress(u.hostname)) return reject(new Error('Refusing to fetch a local address'));

    // A hostname is not enough: evil.example could resolve to 127.0.0.1. Checking at
    // lookup time catches that, and closes the rebinding gap the literal check above
    // cannot see.
    const guardedLookup = (hostname, opts, cb) => {
      require('dns').lookup(hostname, opts, (err, address, family) => {
        if (err) return cb(err);
        const list = Array.isArray(address) ? address : [{ address, family }];
        if (list.some((a) => isInternalAddress(a.address))) {
          return cb(new Error('Refusing to fetch a local address'));
        }
        return Array.isArray(address) ? cb(null, address) : cb(null, address, family);
      });
    };

    const mod = u.protocol === 'https:' ? https : require('http');
    const req = mod.get(u, { headers: { ...BROWSER_HEADERS, ...headers }, timeout, lookup: guardedLookup }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(httpGet(new URL(res.headers.location, u).toString(), { headers, timeout, redirects: redirects + 1 }));
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const type = String(res.headers['content-type'] || '');
      // text, JSON, and the XML family (RSS from Google News, Atom from arXiv)
      if (type && !/text\/|application\/(json|xhtml|xml|atom|rss)|\+xml/i.test(type)) {
        res.resume();
        return reject(new Error('Unsupported content type: ' + type.split(';')[0]));
      }
      let size = 0;
      const chunks = [];
      res.on('data', (c) => {
        size += c.length;
        if (size > MAX_BYTES) { req.destroy(); return reject(new Error('Page too large')); }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), url: u.toString() }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timed out')); });
  });
}

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  return s
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (named[n.toLowerCase()] !== undefined ? named[n.toLowerCase()] : m));
}

// Crude but dependency-free HTML → readable text.
function htmlToText(html) {
  let s = html;
  s = s.replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<\/(p|div|section|article|h[1-6]|li|tr|br)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t ]+/g, ' ');
  s = s.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return s.split('\n').map((l) => l.trim()).filter(Boolean).join('\n').trim();
}

// Page chrome (nav menus, "Jump to content", cookie bars) was eating the character
// budget before the article even started.
const JUNK_LINE = /^(jump to|from wikipedia|main page|contents|current events|random article|about wikipedia|contact us|donate|create account|log ?in|personal tools|toggle|move to sidebar|hide|show|edit|view (source|history)|search|navigation|appearance|tools|languages|print\/export|what links here|related changes|special pages|permanent link|page information|cite this page|skip to|menu|subscribe|sign up|accept( all)? cookies|privacy policy|terms of (use|service)|advertisement)\b/i;

function stripBoilerplate(text) {
  const kept = text.split('\n').filter((l) => l.length > 1 && !JUNK_LINE.test(l.trim()));
  // drop leading fragments until real prose starts
  let start = 0;
  for (let i = 0; i < Math.min(kept.length, 60); i++) {
    if (kept[i].length >= 100) { start = i; break; }
  }
  return kept.slice(start).join('\n').trim() || kept.join('\n').trim();
}

function pageTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).trim().slice(0, 120) : '';
}

/* ---------------- engines ---------------- */

function stripTags(s) {
  return htmlToText(String(s || '')).replace(/\s+/g, ' ').trim();
}

function tagText(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>'));
  if (!m) return '';
  return decodeEntities(m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')).trim();
}

// Independent web index, public API, no key. This is the general-web workhorse
// now that DuckDuckGo blocks automated queries.
async function engineMarginalia(query, limit) {
  // this index is small and often slow — give it room before giving up
  const { body } = await httpGet('https://api.marginalia.nu/public/search/' + encodeURIComponent(query), { headers: { Accept: 'application/json' }, timeout: 22000 });
  const data = JSON.parse(body);
  const out = (data.results || []).slice(0, limit).map((r) => ({
    title: stripTags(r.title).slice(0, 160),
    url: r.url,
    snippet: stripTags(r.description).slice(0, 300),
  })).filter((r) => /^https?:\/\//.test(r.url || ''));
  if (!out.length) throw new Error('No Marginalia results');
  return out;
}

// Current events. Note: RSS links are news.google.com interstitials that do NOT
// server-side redirect to the publisher, so these are headline-only (no page fetch).
async function engineGoogleNews(query, limit) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
  const { body } = await httpGet(url);
  const items = [...body.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
  const out = items.map((m) => {
    const x = m[1];
    const title = tagText(x, 'title');
    const date = tagText(x, 'pubDate');
    const source = (x.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
    return {
      title: title.slice(0, 180),
      url: tagText(x, 'link'),
      snippet: [source && `Source: ${decodeEntities(source)}`, date && `Published: ${date}`].filter(Boolean).join(' · '),
      noFetch: true,
    };
  }).filter((r) => r.title);
  if (!out.length) throw new Error('No Google News results');
  return out;
}

// News with real publisher URLs (fetchable). Public service: hard limit of
// one request per 5 seconds, so skip rather than hammer it.
let lastGdeltAt = 0;
async function engineGdelt(query, limit) {
  const since = Date.now() - lastGdeltAt;
  if (since < 5200) {
    if (since < 3000) throw new Error('GDELT rate limit (1 req / 5s) — skipped');
    await new Promise((r) => setTimeout(r, 5200 - since)); // close enough to be worth waiting
  }
  lastGdeltAt = Date.now();
  const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(query) +
    '&mode=artlist&format=json&sort=datedesc&maxrecords=' + limit;
  const { body } = await httpGet(url, { headers: { Accept: 'application/json' } });
  if (!body.trim().startsWith('{')) throw new Error('GDELT throttled: ' + body.slice(0, 60));
  const arts = (JSON.parse(body).articles || []).slice(0, limit);
  const out = arts.map((a) => ({
    title: stripTags(a.title).slice(0, 180),
    url: a.url,
    snippet: [a.domain, a.seendate && `seen ${a.seendate}`].filter(Boolean).join(' · '),
  })).filter((r) => /^https?:\/\//.test(r.url || ''));
  if (!out.length) throw new Error('No GDELT results');
  return out;
}

// Stack Overflow's own pages return 403 to any fetcher, so pull the question body
// straight from the API instead (filter=withbody) — no page fetch needed.
async function engineStackExchange(query, limit) {
  const url = 'https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&site=stackoverflow&filter=withbody&pagesize=' +
    limit + '&q=' + encodeURIComponent(query);
  const { body } = await httpGet(url, { headers: { Accept: 'application/json' } });
  const items = (JSON.parse(body).items || []).slice(0, limit);
  const out = items.map((i) => {
    const text = stripTags(i.body).slice(0, 2500);
    return {
      title: decodeEntities(i.title || '').slice(0, 180),
      url: i.link,
      snippet: [i.is_answered ? 'answered' : 'unanswered', `score ${i.score}`, (i.tags || []).slice(0, 4).join(', ')].filter(Boolean).join(' · '),
      text,
      fetched: !!text,
      noFetch: true, // body already supplied by the API
    };
  }).filter((r) => /^https?:\/\//.test(r.url || ''));
  if (!out.length) throw new Error('No StackExchange results');
  return out;
}

async function engineHackerNews(query, limit) {
  const url = 'https://hn.algolia.com/api/v1/search?hitsPerPage=' + limit + '&query=' + encodeURIComponent(query);
  const { body } = await httpGet(url, { headers: { Accept: 'application/json' } });
  const hits = (JSON.parse(body).hits || []).slice(0, limit);
  const out = hits.map((h) => ({
    title: (h.title || h.story_title || '').slice(0, 180),
    url: h.url || h.story_url || ('https://news.ycombinator.com/item?id=' + h.objectID),
    snippet: [`${h.points || 0} points`, `${h.num_comments || 0} comments`, (h.created_at || '').slice(0, 10)].join(' · '),
  })).filter((r) => r.title && /^https?:\/\//.test(r.url || ''));
  if (!out.length) throw new Error('No Hacker News results');
  return out;
}

async function engineArxiv(query, limit) {
  const url = 'https://export.arxiv.org/api/query?max_results=' + limit + '&search_query=all:' + encodeURIComponent(query);
  const { body } = await httpGet(url);
  const entries = [...body.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, limit);
  const out = entries.map((m) => ({
    title: stripTags(tagText(m[1], 'title')).slice(0, 180),
    url: tagText(m[1], 'id'),
    snippet: stripTags(tagText(m[1], 'summary')).slice(0, 300),
  })).filter((r) => /^https?:\/\//.test(r.url || ''));
  if (!out.length) throw new Error('No arXiv results');
  return out;
}

// Live prediction markets with real prices. Public API, no key.
async function enginePolymarket(query, limit) {
  // Polymarket matches market titles, so drop the framing words and keep the subject:
  // "what are the odds of a recession on polymarket" -> "recession"
  // Polymarket's search collapses on stray words: "milei" returns the Argentina
  // election markets, while "milei and" returns LIBRA and a podcast. Keep only keywords.
  let topic = String(query)
    .replace(/\b(polymarket|kalshi|prediction markets?|betting|bet|bets|odds|probability|chances?|likelihood|markets?|what('s| is| are)?|who|whom|which|when|where|how|the|of|on|a|an|for|in|to|will|there|be|by|is|are|was|were|do|does|did|can|could|would|should|and|or|but|with|from|about|give|tell|show|find|me|my|your|you|opinion|opinions|thoughts|take|please|some|any|good|really|interesting|right now|currently)\b/gi, ' ')
    .replace(/[?¿!¡.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–]+|[\s\-–]+$/g, '')
    .trim();
  if (topic.split(/\s+/).filter(Boolean).length < 1 || topic.length < 3) topic = query;
  const url = 'https://gamma-api.polymarket.com/public-search?q=' + encodeURIComponent(topic);
  const { body } = await httpGet(url, { headers: { Accept: 'application/json' } });
  const events = (JSON.parse(body).events || []).slice(0, limit);
  const out = events.map((ev) => {
    const markets = (ev.markets || []).map((m) => {
      let prices = m.outcomePrices;
      try { prices = typeof prices === 'string' ? JSON.parse(prices) : prices; } catch { prices = null; }
      let outcomes = m.outcomes;
      try { outcomes = typeof outcomes === 'string' ? JSON.parse(outcomes) : outcomes; } catch { outcomes = null; }
      if (!prices || !prices.length) return `- ${m.question}`;
      const pct = prices.map((p, i) => `${(outcomes && outcomes[i]) || 'Outcome ' + (i + 1)} ${(parseFloat(p) * 100).toFixed(1)}%`).join(' / ');
      return `- ${m.question}: ${pct}`;
    }).slice(0, 12);
    const vol = Number(ev.volume || 0);
    const meta = [
      vol ? `volume $${Math.round(vol).toLocaleString('en-US')}` : '',
      ev.endDate ? `ends ${String(ev.endDate).slice(0, 10)}` : '',
      ev.closed ? 'CLOSED' : 'open',
    ].filter(Boolean).join(' · ');
    return {
      title: (ev.title || '').slice(0, 180),
      url: 'https://polymarket.com/event/' + ev.slug,
      snippet: meta,
      text: [`${ev.title} (${meta})`, '', 'Current market prices (these ARE the crowd probabilities):', ...markets].join('\n'),
      fetched: true,
      noFetch: true, // prices come from the API; the web page adds nothing
    };
  }).filter((r) => r.title);
  if (!out.length) throw new Error('No Polymarket markets matched');
  return out;
}

// Live aircraft positions. OpenSky is free and key-less, but it tracks planes in the
// air right now — it cannot price or book tickets.
const IATA_TO_ICAO = {
  IB: 'IBE', BA: 'BAW', AA: 'AAL', UA: 'UAL', DL: 'DAL', LH: 'DLH', AF: 'AFR', KL: 'KLM',
  FR: 'RYR', U2: 'EZY', VY: 'VLG', W6: 'WZZ', EK: 'UAE', QR: 'QTR', TK: 'THY', LX: 'SWR',
  AZ: 'ITY', SN: 'BEL', TP: 'TAP', SK: 'SAS', AY: 'FIN', OS: 'AUA', EI: 'EIN', LO: 'LOT',
  AC: 'ACA', AM: 'AMX', AV: 'AVA', LA: 'LAN', AR: 'ARG', CM: 'CMP', JL: 'JAL', NH: 'ANA',
  SQ: 'SIA', CX: 'CPA', QF: 'QFA', NZ: 'ANZ', ET: 'ETH', MS: 'MSR', SU: 'AFL', B6: 'JBU',
  WN: 'SWA', AS: 'ASA', F9: 'FFT', NK: 'NKS',
};

let flightCache = { at: 0, states: null };
async function fetchFlightStates() {
  if (flightCache.states && Date.now() - flightCache.at < 60000) return flightCache.states;
  const { body } = await httpGet('https://opensky-network.org/api/states/all', { headers: { Accept: 'application/json' }, timeout: 25000 });
  const states = JSON.parse(body).states || [];
  flightCache = { at: Date.now(), states };
  return states;
}

async function engineFlights(query, limit) {
  const codes = [...String(query).toUpperCase().matchAll(/\b([A-Z]{2,3})\s?(\d{1,4})\b/g)];
  if (!codes.length) throw new Error('No flight number found in the question (try e.g. "where is IB3170")');
  const wanted = new Set();
  for (const [, prefix, num] of codes) {
    wanted.add(prefix + num);
    if (IATA_TO_ICAO[prefix]) wanted.add(IATA_TO_ICAO[prefix] + num);
  }
  const states = await fetchFlightStates();
  const hits = states.filter((s) => {
    const cs = String(s[1] || '').replace(/\s+/g, '').toUpperCase();
    return cs && [...wanted].some((w) => cs === w || cs.startsWith(w));
  }).slice(0, limit);

  if (!hits.length) {
    throw new Error(`Flight ${[...wanted][0]} is not airborne right now (OpenSky only sees aircraft currently in the air)`);
  }
  return hits.map((s) => {
    const cs = String(s[1] || '').trim();
    const [lon, lat, alt, vel, hdg] = [s[5], s[6], s[7] ?? s[13], s[9], s[10]];
    const facts = [
      `Callsign ${cs}`,
      s[2] ? `registered in ${s[2]}` : '',
      lat != null && lon != null ? `position ${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}` : '',
      alt != null ? `altitude ${Math.round(alt)} m` : '',
      vel != null ? `ground speed ${Math.round(vel * 3.6)} km/h` : '',
      hdg != null ? `heading ${Math.round(hdg)}°` : '',
      s[8] ? 'ON GROUND' : 'in the air',
    ].filter(Boolean).join(' · ');
    return {
      title: `${cs} — live position`,
      url: 'https://opensky-network.org/aircraft-profile?icao24=' + encodeURIComponent(s[0]),
      snippet: facts,
      text: `Live flight data from OpenSky (updated seconds ago):\n${facts}\nNote: this is a live radar position, not a schedule or ticket price.`,
      fetched: true,
      noFetch: true,
    };
  });
}

// Shopping: Amazon, AliExpress, MercadoLibre and eBay all block direct access
// (403/503/bot walls) and their real APIs need paid or approved keys. The best
// key-free approach is a site-restricted query through the general engines.
const SHOP_SITES = ['amazon.com', 'amazon.es', 'aliexpress.com', 'mercadolibre.com', 'ebay.com'];
async function engineShopping(query, limit, settings) {
  const scoped = `${query} (${SHOP_SITES.map((s) => 'site:' + s).join(' OR ')})`;
  const key = ((settings && settings.braveApiKey) || '').trim();
  const errors = [];
  for (const [name, fn] of [['Brave', key ? (q, n) => engineBrave(q, n, key) : null], ['DuckDuckGo', engineDuckDuckGo]]) {
    if (!fn) continue;
    try {
      const res = await fn(scoped, limit);
      const shop = res.filter((r) => SHOP_SITES.some((s) => (r.url || '').includes(s)));
      if (shop.length) return shop.map((r) => ({ ...r, snippet: (r.snippet || '') + ' · product page (live price not retrievable)' }));
    } catch (e) { errors.push(`${name}: ${e.message}`); }
  }
  throw new Error('Shop sites block automated access; needs a working Brave/DuckDuckGo search' + (errors.length ? ' — ' + errors.join(', ') : ''));
}

// Returns [] on failure so the caller falls through to the next engine.
async function engineDuckDuckGo(query, limit) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  const { body } = await httpGet(url, { headers: { Referer: 'https://duckduckgo.com/' } });
  if (/challenge|anomaly/i.test(pageTitle(body))) throw new Error('DuckDuckGo rate-limited this request');
  const out = [];
  const re = /class="result__a"[^>]*href="(.*?)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(body)) && out.length < limit) {
    let href = decodeEntities(m[1]);
    if (href.startsWith('//')) href = 'https:' + href;
    // DDG wraps links: //duckduckgo.com/l/?uddg=<encoded real url>
    try {
      const parsed = new URL(href);
      if (parsed.hostname.endsWith('duckduckgo.com') && parsed.searchParams.get('uddg')) {
        href = parsed.searchParams.get('uddg');
      }
    } catch { continue; }
    const title = htmlToText(m[2]).slice(0, 160);
    if (/^https?:\/\//.test(href)) out.push({ title, url: href, snippet: '' });
  }
  const snips = [...body.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
  out.forEach((r, i) => { if (snips[i]) r.snippet = htmlToText(snips[i][1]).slice(0, 300); });
  if (!out.length) throw new Error('No DuckDuckGo results parsed');
  return out;
}

// Optional, only if the user pasted a Brave Search API key in Settings.
async function engineBrave(query, limit, apiKey) {
  const url = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query) + '&count=' + limit;
  const { body } = await httpGet(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } });
  const data = JSON.parse(body);
  const items = (data && data.web && data.web.results) || [];
  const out = items.slice(0, limit).map((r) => ({
    title: String(r.title || '').slice(0, 160),
    url: String(r.url || ''),
    snippet: htmlToText(String(r.description || '')).slice(0, 300),
  })).filter((r) => /^https?:\/\//.test(r.url));
  if (!out.length) throw new Error('No Brave results');
  return out;
}

// Always-available fallback: documented API, no key, no bot-blocking.
async function engineWikipedia(query, limit) {
  const api = 'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=' + limit + '&srsearch=' + encodeURIComponent(query);
  // Wikimedia's policy asks for a descriptive User-Agent; a generic browser one gets throttled.
  const { body } = await httpGet(api, { headers: { Accept: 'application/json', 'User-Agent': 'Portico/0.5 (local LLM desktop app; contact via github)' } });
  const data = JSON.parse(body);
  const items = (data && data.query && data.query.search) || [];
  if (!items.length) throw new Error('No Wikipedia results');
  const out = items.map((r) => ({
    title: r.title,
    url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(r.title).replace(/ /g, '_')),
    snippet: htmlToText(r.snippet || '').slice(0, 300),
  }));

  // Pull clean article prose from the API instead of scraping the page (whose first
  // screenful is navigation chrome, not content).
  const WIKI_UA = { Accept: 'application/json', 'User-Agent': 'Portico/0.9 (local LLM desktop app)' };
  const extracts = async (params) => {
    const { body: b } = await httpGet('https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&' + params, { headers: WIKI_UA });
    const pages = (JSON.parse(b).query || {}).pages || {};
    const byTitle = {};
    for (const k of Object.keys(pages)) if (pages[k].title) byTitle[pages[k].title] = pages[k].extract || '';
    return byTitle;
  };
  try {
    // MediaWiki caps full extracts at one page per request, so: intros for everything…
    const intros = await extracts('exintro=1&exlimit=max&titles=' + encodeURIComponent(out.map((r) => r.title).join('|')));
    for (const r of out) {
      const t = intros[r.title];
      if (t && t.length > 120) { r.text = t.slice(0, 4000); r.fetched = true; r.noFetch = true; }
    }
    // …then the full article for the best match, where the detail actually lives.
    if (out[0]) {
      const full = await extracts('exlimit=1&titles=' + encodeURIComponent(out[0].title));
      const t = full[out[0].title];
      if (t && t.length > (out[0].text || '').length) { out[0].text = t.slice(0, 8000); out[0].fetched = true; out[0].noFetch = true; }
    }
  } catch { /* fall back to fetching the page */ }
  return out;
}

/* ---------------- query cleaning ---------------- */

// Search engines answer keywords, not chat messages. Measured on Wikipedia:
// "Who founded Polymarket? Answer in one sentence and cite your source."
//   -> 1 irrelevant result
// "Who founded Polymarket?"
//   -> Polymarket | Shayne Coplan | Kalshi   (exactly right)
// So: keep the first question or sentence, drop trailing formatting instructions.
// "Explain X in two paragraphs" → the search engine only wants "X".
// "create a word document of the 2nd Trump term" -> the engine only wants the subject.
const DOC_REQUEST = /^\s*(please\s+)?(can you\s+|could you\s+)?(create|make|generate|draft|write|prepare|build|do)\s+(me\s+)?(a|an|the)?\s*(word|excel|pdf)?\s*(document|doc|report|summary|essay|article|paper|file|memo|note|presentation|slide deck|list|table)s?\s*(of|about|on|for|covering|regarding|with)?\s*/i;
const LEADING_INSTRUCTION = /^\s*(please\s+)?(can you\s+|could you\s+)?(explain|tell me about|tell me|summari[sz]e|describe|write about|write|list|give me|show me|find|search for|look up|what do you know about)\b[:,]?\s*/i;
// Only strips a trailing clause introduced by a connector, so real content survives.
const TRAILING_INSTRUCTION = /\s*[,;]?\s*\b(and|then)?\s*(please\s+)?(answer|reply|respond|cite|explain|summari[sz]e)\b[^?]*$/i;
const INSTRUCTION_PHRASES = /\b(in (one|a|two|three|\d+) (sentence|sentences|paragraph|paragraphs|words|bullet points?)|briefly|in detail|step by step|cite (your )?sources?|with sources?|please|give me your (opinion|thoughts|take)|your (opinion|thoughts|take) on|what do you think)\b/gi;

function cleanQuery(text) {
  const original = String(text || '').trim();
  if (!original) return '';
  let q = original.split(/\n/)[0].trim();          // first line only
  const question = q.match(/^[\s\S]{3,220}?\?/);   // …up to the first question mark
  if (question) {
    q = question[0];
  } else {
    const doc = q.replace(DOC_REQUEST, '');
    if (doc.trim().split(/\s+/).length >= 2) q = doc; // keep it only if a subject remains
    q = q.replace(LEADING_INSTRUCTION, '');
    q = q.split(/(?<=[.!])\s/)[0];                 // …or the first sentence
    const trimmed = q.replace(TRAILING_INSTRUCTION, '');
    if (trimmed.trim().length >= 3) q = trimmed;   // never strip away everything
  }
  q = q.replace(INSTRUCTION_PHRASES, ' ').replace(/\s+/g, ' ').trim();
  q = q.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '');
  if (q.length < 3) q = original;                  // never search for nothing
  return q.slice(0, 220);
}

/* ---------------- orchestration ---------------- */

// Which specialist sources are worth adding for this question?
// "market" alone is far too broad — it fired on "how does a prediction market work".
const RE_NEWS = /\b(news|latest|today|yesterday|this (week|month|year)|recent(ly)?|currently|right now|happening|update|announced|election|crisis|war|headline|stock price|share price|20[2-9]\d)\b/i;
const RE_TECH = /\b(code|coding|program(ming)?|script|function|class|api|library|framework|error|exception|bug|crash|install|npm|pip|docker|linux|windows|git|regex|sql|database|python|javascript|typescript|java|rust|golang|c\+\+|c#|html|css|react|node)\b/i;
const RE_ACADEMIC = /\b(paper|papers|study|studies|research|scientific|journal|thesis|theorem|proof|algorithm|dataset|arxiv|equation|hypothesis)\b/i;
// "will …?" is the shape of almost every prediction market, so treat it as a signal.
// Election/outcome questions are prediction markets even when phrased plainly:
// "and on who will win argentine elections" never reached Polymarket before.
const RE_MARKETS = /\b(polymarket|kalshi|prediction markets?|betting odds|betting market|odds (of|on|that)|probability (of|that)|chances? (of|that)|who (will|is going to) win|who wins|will win|election (winner|result)|next (president|prime minister|pope|chancellor)|who (is|will be) the next)\b|^\s*will\b/i;
const RE_FLIGHTS = /\b(flight|flights|airline|airplane|aircraft|callsign|tail number|where is [a-z]{2,3}\s?\d{1,4}\b)|\b[A-Z]{2,3}\s?\d{2,4}\b/;
const RE_SHOPPING = /\b(buy|price of|how much (is|are|does)|cheap(est)?|shop|shopping|purchase|amazon|aliexpress|mercado ?libre|ebay|deal|discount|order online)\b/i;

// The engine roster the user can switch on and off in Settings.
// kind 'web' engines run on every search; the others run only when the question
// looks like their speciality (or always, if the user ticks "always use").
const ENGINES = [
  {
    id: 'brave', label: 'Brave Search', kind: 'web', needsKey: true,
    desc: 'Best general results. Needs a free API key (2,000 searches/month).',
    fn: (q, n, s) => engineBrave(q, n, (s.braveApiKey || '').trim()),
  },
  {
    id: 'marginalia', label: 'Marginalia', kind: 'web',
    desc: 'Independent index. Finds blogs and long-form writing the big engines bury. Can be slow.',
    fn: engineMarginalia,
  },
  {
    id: 'duckduckgo', label: 'DuckDuckGo', kind: 'web',
    desc: 'Broad general results, but blocks you temporarily if used very rapidly.',
    fn: engineDuckDuckGo,
  },
  {
    id: 'wikipedia', label: 'Wikipedia', kind: 'web',
    desc: 'Encyclopedia facts. Very reliable, never blocks.',
    fn: engineWikipedia,
  },
  {
    id: 'googlenews', label: 'Google News', kind: 'news',
    desc: 'Recent headlines with outlet and date. Headlines only — full articles cannot be opened.',
    fn: engineGoogleNews,
  },
  {
    id: 'gdelt', label: 'GDELT news', kind: 'news',
    desc: 'World news with readable article links. Limited to one search every 5 seconds.',
    fn: engineGdelt,
  },
  {
    id: 'stackexchange', label: 'Stack Overflow', kind: 'tech',
    desc: 'Programming questions and answers, with the answer text included.',
    fn: engineStackExchange,
  },
  {
    id: 'hackernews', label: 'Hacker News', kind: 'tech',
    desc: 'Tech news and discussion threads.',
    fn: engineHackerNews,
  },
  {
    id: 'arxiv', label: 'arXiv', kind: 'academic',
    desc: 'Scientific preprints — physics, maths, computer science.',
    fn: engineArxiv,
  },
  {
    id: 'polymarket', label: 'Polymarket', kind: 'markets',
    desc: 'Live prediction-market odds and volumes, straight from Polymarket’s API.',
    fn: enginePolymarket,
  },
  {
    id: 'flights', label: 'Live flights', kind: 'flights',
    desc: 'Tracks aircraft in the air right now by flight number (e.g. “where is IB3170”). Cannot price or book tickets.',
    fn: engineFlights,
  },
  {
    id: 'shopping', label: 'Shopping', kind: 'shopping',
    desc: 'Finds product pages on Amazon, AliExpress, MercadoLibre and eBay. Those sites block bots, so this needs DuckDuckGo or a Brave key — and live prices are never available.',
    fn: engineShopping,
  },
];

function engineInfo() {
  return ENGINES.map(({ id, label, kind, desc, needsKey }) => ({ id, label, kind, desc, needsKey: !!needsKey }));
}

function isEnabled(engine, settings) {
  const chosen = (settings && settings.searchEngines) || {};
  const on = chosen[engine.id] === undefined ? engine.id !== 'brave' : !!chosen[engine.id];
  if (!on) return false;
  if (engine.needsKey && !((settings && settings.braveApiKey) || '').trim()) return false;
  return true;
}

function selectEngines(query, settings) {
  const s = settings || {};
  const always = !!s.searchAlwaysAllSources;
  const matches = {
    web: true,
    news: always || RE_NEWS.test(query),
    tech: always || RE_TECH.test(query),
    academic: always || RE_ACADEMIC.test(query),
    markets: always || RE_MARKETS.test(query),
    // these two are noisy if run on everything, so they stay strictly on-topic
    flights: RE_FLIGHTS.test(query),
    shopping: RE_SHOPPING.test(query),
  };
  // A source that matched the question specifically (a market, a flight, a shop) is more
  // on-point than a general engine, and must not be crowded out of a short result list.
  const PRIORITY = { markets: 0, flights: 0, shopping: 0, tech: 1, academic: 1, web: 2, news: 3 };
  return ENGINES
    .filter((e) => isEnabled(e, s) && matches[e.kind])
    .sort((a, b) => (PRIORITY[a.kind] ?? 9) - (PRIORITY[b.kind] ?? 9))
    .map((e) => [e.label, (q, n) => e.fn(q, n, s), e.kind]);
}

// Run a sample query through each enabled engine so the user can see what works today.
async function testEngines(settings, query = 'prediction market') {
  const s = settings || {};
  return Promise.all(ENGINES.map(async (e) => {
    const base = { id: e.id, label: e.label, kind: e.kind };
    if (!isEnabled(e, s)) {
      const chosen = (s.searchEngines || {});
      const off = chosen[e.id] === false || (e.id === 'brave' && chosen[e.id] === undefined);
      return { ...base, skipped: true, reason: off ? 'turned off' : 'no API key' };
    }
    const t0 = Date.now();
    try {
      const r = await e.fn(query, 3, s);
      return { ...base, ok: true, count: r.length, ms: Date.now() - t0 };
    } catch (err) {
      return { ...base, ok: false, error: err.message, ms: Date.now() - t0 };
    }
  }));
}

function normalizeUrl(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    x.search = '';
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch { return String(u).toLowerCase(); }
}

// Query every selected source in parallel, then interleave so each source gets a
// voice instead of one source flooding the list.
async function searchEngines(query, limit, settings) {
  const engines = selectEngines(query, settings);
  if (!engines.length) throw new Error('No search engines are switched on for this kind of question — check the globe menu or Settings');
  const perEngine = Math.max(3, Math.ceil(limit / 2));

  const settled = await Promise.all(engines.map(async ([name, fn, kind]) => {
    try {
      const results = await fn(query, perEngine);
      return { name, kind, results: results.map((r) => ({ ...r, source: name, kind })) };
    } catch (e) {
      return { name, kind, error: e.message, results: [] };
    }
  }));

  const used = settled.filter((s) => s.results.length).map((s) => s.name);
  const tried = settled.filter((s) => s.error).map((s) => `${s.name}: ${s.error}`);

  const merged = [];
  const seen = new Set();
  for (let i = 0; merged.length < limit; i++) {
    let added = false;
    for (const s of settled) {
      const r = s.results[i];
      if (!r) continue;
      added = true;
      const key = normalizeUrl(r.url);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
      if (merged.length >= limit) break;
    }
    if (!added) break;
  }

  if (!merged.length) {
    const err = new Error('All search sources failed — ' + tried.join(' | '));
    err.tried = tried;
    throw err;
  }
  return { engine: used.join(' + '), engines: used, results: merged, tried };
}

// Full research pass: search, then read the top pages.
async function research(rawQuery, opts = {}) {
  const settings = opts.settings || {};
  const query = cleanQuery(rawQuery);
  if (!query) throw new Error('Empty search query');
  const limit = Math.min(Math.max(opts.maxResults || 5, 1), 8);
  const readCount = Math.min(opts.readPages === undefined ? 3 : opts.readPages, limit);
  const charBudget = Math.max(3000, Math.min(opts.charBudget || 9000, 40000));

  // be polite: never hammer the engines
  const wait = 2500 - (Date.now() - lastSearchAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearchAt = Date.now();

  const { engine, engines, results, tried } = await searchEngines(query, limit, settings);

  // Only fetch pages we can actually read (Google News links are interstitials).
  const readable = results.filter((r) => !r.noFetch).slice(0, readCount);
  const perPage = Math.floor(charBudget / Math.max(readable.length, 1));
  await Promise.all(readable.map(async (r) => {
    try {
      const { body } = await httpGet(r.url, { timeout: 12000 });
      const text = stripBoilerplate(htmlToText(body));
      if (text.length > 200) {
        r.text = text.slice(0, perPage);
        r.fetched = true;
        if (!r.title) r.title = pageTitle(body);
      }
    } catch (e) {
      r.fetchError = e.message;
    }
  }));

  return { query, engine, engines, tried, fetchedAt: new Date().toISOString(), results };
}

module.exports = { research, htmlToText, cleanQuery, engineInfo, testEngines };
