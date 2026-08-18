#!/usr/bin/env node
/**
 * Pins a SHA-256 into every catalogue entry, taken from Hugging Face itself.
 *
 * Hugging Face stores large files in Git LFS, and an LFS object id *is* the SHA-256
 * of the file's contents. So the hash is not something we invent or measure locally:
 * it is what the repository says the file is, published alongside it.
 *
 * Pinning matters because checking a download against a hash fetched at the same
 * moment from the same server proves nothing. A hash recorded here, in the app, and
 * shipped in the installer, is a claim that can be checked later — it catches a file
 * swapped after this release was built, a corrupted mirror, or a truncated download.
 *
 *   node scripts/pin-model-hashes.js          # fill in anything missing
 *   node scripts/pin-model-hashes.js --all    # re-check every entry, including pinned
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS = path.join(__dirname, '..', 'src', 'main', 'models.js');
const ALL = process.argv.includes('--all');

const getJson = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'portico-catalogue' } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume();
      return resolve(getJson(new URL(res.headers.location, url).toString()));
    }
    if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
    let d = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { d += c; });
    res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

// https://huggingface.co/<owner>/<repo>/resolve/<rev>/<path...>
function parse(url) {
  const m = /^https:\/\/huggingface\.co\/([^/]+)\/([^/]+)\/resolve\/([^/]+)\/(.+)$/.exec(url);
  if (!m) return null;
  return { repo: `${m[1]}/${m[2]}`, rev: m[3], file: decodeURIComponent(m[4]) };
}

const treeCache = new Map();
async function hashFor(url) {
  const p = parse(url);
  if (!p) return { error: 'not a Hugging Face resolve URL' };
  // one listing per repo+folder, reused across the entries that share it
  const dir = p.file.includes('/') ? p.file.slice(0, p.file.lastIndexOf('/')) : '';
  const key = `${p.repo}@${p.rev}/${dir}`;
  if (!treeCache.has(key)) {
    const api = `https://huggingface.co/api/models/${p.repo}/tree/${p.rev}${dir ? '/' + dir : ''}`;
    treeCache.set(key, getJson(api).catch((e) => ({ __error: e.message })));
  }
  const tree = await treeCache.get(key);
  if (tree && tree.__error) return { error: tree.__error };
  const entry = (Array.isArray(tree) ? tree : []).find((f) => f.path === p.file);
  if (!entry) return { error: 'file not listed in the repository' };
  // LFS object ids are sha256; a small file stored in git directly has none, and a
  // git blob id is sha1 over a different preimage, so it must not be used here
  if (!entry.lfs || !/^[0-9a-f]{64}$/.test(entry.lfs.oid)) {
    return { error: 'not stored in LFS, so no published sha256' };
  }
  return { sha256: entry.lfs.oid, size: entry.lfs.size };
}

(async () => {
  let src = fs.readFileSync(MODELS, 'utf8');
  // every catalogue entry, as a block, so the write-back stays anchored to its own url
  const blocks = [...src.matchAll(/\{\s*\n(?:[^{}]|\{[^{}]*\})*?url:\s*'([^']+)'(?:[^{}]|\{[^{}]*\})*?\n\s*\}/g)];
  let pinned = 0, kept = 0, failed = [];

  for (const b of blocks) {
    const block = b[0];
    const url = b[1];
    const already = /sha256:\s*'[0-9a-f]{64}'/.test(block);
    if (already && !ALL) { kept++; continue; }

    const r = await hashFor(url);
    const name = (/id:\s*'([^']+)'/.exec(block) || [, '?'])[1];
    if (r.error) { failed.push(`${name}: ${r.error}`); continue; }

    let updated;
    if (already) {
      updated = block.replace(/sha256:\s*'[0-9a-f]{64}'/, `sha256: '${r.sha256}'`);
    } else {
      // sits right under the url it belongs to
      updated = block.replace(/(url:\s*'[^']+',)/, `$1\n    sha256: '${r.sha256}',`);
    }
    if (updated !== block) { src = src.replace(block, updated); pinned++; }
    process.stdout.write(`  ${name.padEnd(24)} ${r.sha256.slice(0, 16)}…  ${(r.size / 1e9).toFixed(2)} GB\n`);
  }

  fs.writeFileSync(MODELS, src);
  console.log(`\n  ${pinned} pinned, ${kept} already had one`);
  if (failed.length) {
    console.log(`\n  no hash for ${failed.length} entr${failed.length > 1 ? 'ies' : 'y'} — these download unverified:`);
    for (const f of failed) console.log(`    ${f}`);
  }
})();
