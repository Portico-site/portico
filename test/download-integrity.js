/* Portico download-integrity tests.
 *
 * The catalogue pins a sha256 for every model, taken from the repository that
 * publishes it. These checks prove the downloader actually enforces it — including
 * the resumed case, where the bytes already on disk never passed through the running
 * hash and the finished file has to be read back instead.
 *
 * A local server stands in for Hugging Face, so nothing here touches the network
 * or moves gigabytes:
 *
 *   node test/download-integrity.js
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// models.js holds a reference to the https module object, not to its get function,
// so replacing the property here is enough to route its requests at the test server.
const realGet = https.get;
https.get = (url, opts, cb) => http.get(String(url).replace(/^https:/, 'http:'), opts, cb);

const { Downloader } = require(path.join(__dirname, '..', 'src', 'main', 'models'));

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (got !== undefined ? '  — ' + JSON.stringify(got) : '')); }
};

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'portico-dl-'));
const BODY = Buffer.from('a model file, or near enough for a checksum'.repeat(400));
const GOOD = crypto.createHash('sha256').update(BODY).digest('hex');
const WRONG = 'f'.repeat(64);

// serves BODY, honours Range so the resume path can be exercised
let served = 0;
const server = http.createServer((req, res) => {
  served++;
  const m = /^bytes=(\d+)-$/.exec(req.headers.range || '');
  if (m) {
    const from = parseInt(m[1], 10);
    res.writeHead(206, { 'Content-Length': BODY.length - from,
      'Content-Range': `bytes ${from}-${BODY.length - 1}/${BODY.length}` });
    return res.end(BODY.subarray(from));
  }
  res.writeHead(200, { 'Content-Length': BODY.length });
  res.end(BODY);
});

const run = (id, sha, dest, seed) => new Promise((resolve) => {
  const d = new Downloader();
  const events = [];
  d.on('progress', (p) => events.push(p));
  if (seed !== undefined) fs.writeFileSync(dest + '.part', seed);
  d.download(id, `https://127.0.0.1:${server.address().port}/model.gguf`, dest, sha)
    .then((p) => resolve({ resolved: p, events, error: null }))
    .catch((e) => resolve({ resolved: null, events, error: e.message }));
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));

  // --- the hash matches ---
  let dest = path.join(DIR, 'good.gguf');
  let r = await run('good', GOOD, dest);
  ok('a file matching its checksum is kept', fs.existsSync(dest) && r.resolved === dest, r.error);
  ok('its contents are exactly what was served', fs.existsSync(dest)
    && crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex') === GOOD);
  ok('the finished event says the checksum was verified',
    r.events.some((e) => e.done && e.checksum === 'ok'), r.events.slice(-1));
  ok('no leftover .part', !fs.existsSync(dest + '.part'));

  // --- the hash does not match ---
  dest = path.join(DIR, 'bad.gguf');
  r = await run('bad', WRONG, dest);
  ok('a file failing its checksum is rejected', r.resolved === null && !!r.error, r);
  ok('and is not left on disk', !fs.existsSync(dest) && !fs.existsSync(dest + '.part'));
  ok('the error names the checksum', /checksum/i.test(r.error || ''), r.error);
  ok('the error says the file was deleted', /deleted/i.test(r.error || ''), r.error);
  ok('the event marks the failure', r.events.some((e) => e.checksum === 'failed'), r.events.slice(-1));

  // --- no pinned hash: still downloads, but says it was not checked ---
  dest = path.join(DIR, 'unpinned.gguf');
  r = await run('unpinned', undefined, dest);
  ok('an entry with no pinned hash still downloads', r.resolved === dest && fs.existsSync(dest));
  ok('and reports itself as unchecked rather than verified',
    r.events.some((e) => e.done && e.checksum === 'none'), r.events.slice(-1));

  // --- resumed download: the bytes on disk were never hashed in flight ---
  dest = path.join(DIR, 'resumed.gguf');
  r = await run('resumed', GOOD, dest, BODY.subarray(0, 5000));
  ok('a resumed download completes', r.resolved === dest && fs.existsSync(dest), r.error);
  ok('and is verified by reading the whole file back',
    r.events.some((e) => e.verifying) && r.events.some((e) => e.done && e.checksum === 'ok'),
    r.events.map((e) => Object.keys(e).join('+')).slice(-3));
  ok('the resumed file is byte-correct', fs.existsSync(dest)
    && crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex') === GOOD);

  // --- resumed onto bytes that were already wrong ---
  dest = path.join(DIR, 'poisoned.gguf');
  const junk = Buffer.alloc(5000, 0x41);
  r = await run('poisoned', GOOD, dest, junk);
  ok('a resume over corrupted bytes is caught, not trusted', r.resolved === null && !!r.error, r);
  ok('and the bad .part is cleared so the retry starts clean', !fs.existsSync(dest + '.part'));

  // --- the catalogue itself ---
  const { CATALOG } = require(path.join(__dirname, '..', 'src', 'main', 'models'));
  const missing = CATALOG.filter((m) => !/^[0-9a-f]{64}$/.test(String(m.sha256 || '')));
  ok(`every catalogue entry carries a sha256 (${CATALOG.length} models)`, missing.length === 0,
    missing.map((m) => m.id));
  const dupes = Object.entries(CATALOG.reduce((a, m) => {
    if (m.sha256) (a[m.sha256] = a[m.sha256] || []).push(m.id); return a;
  }, {})).filter(([, ids]) => ids.length > 1 && new Set(ids).size > 1);
  ok('no two different models share a hash', dupes.length === 0, dupes);

  server.close();
  https.get = realGet;
  fs.rmSync(DIR, { recursive: true, force: true });
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
