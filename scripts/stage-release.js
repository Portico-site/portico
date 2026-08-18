#!/usr/bin/env node
/**
 * Copies the freshly built Windows installer to the website's downloads folder
 * and reports what the site will actually serve.
 *
 * This exists because the two used to drift: the installer would be rebuilt while
 * the copy on the site stayed behind, so the download link handed out old code
 * under the current version number. `npm run release` does both in one step.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const VERSION = pkg.version;

const built = path.join(ROOT, 'dist', `Portico Setup ${VERSION}.exe`);
const siteDir = path.join(ROOT, '..', 'portico-site', 'downloads');
const dest = path.join(siteDir, `Portico-Setup-${VERSION}.exe`);

if (!fs.existsSync(built)) {
  console.error(`\n  No installer for ${VERSION} at:\n    ${built}\n`);
  console.error('  Run `npm run dist` first.\n');
  process.exit(1);
}

if (!fs.existsSync(siteDir)) {
  console.log(`\n  No website folder at ${siteDir} — skipping the copy.`);
  console.log(`  Installer is ready at:\n    ${built}\n`);
  process.exit(0);
}

// drop installers from older versions so the folder never accumulates stale builds
let removed = 0;
for (const f of fs.readdirSync(siteDir)) {
  if (/^Portico-Setup-.*\.exe$/i.test(f) && f !== path.basename(dest)) {
    fs.unlinkSync(path.join(siteDir, f));
    removed++;
  }
}

fs.copyFileSync(built, dest);

const mb = (p) => (fs.statSync(p).size / 1048576).toFixed(1) + ' MB';
console.log(`\n  Staged Portico ${VERSION}`);
console.log(`    installer : ${built}  (${mb(built)})`);
console.log(`    website   : ${dest}`);
if (removed) console.log(`    removed   : ${removed} older installer(s)`);

// The pages publish a checksum for people who want to verify the download. NSIS
// output is not reproducible, so every rebuild changes it — left to a human it goes
// stale, and a stale checksum reads as a tampered file. Rewrite it from the bytes.
const SITE = path.join(ROOT, '..', 'portico-site');
const sha = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex').toUpperCase();
const sizeMB = Math.round(fs.statSync(dest).size / 1048576);
let stamped = 0;
for (const p of fs.readdirSync(SITE).filter((f) => f.endsWith('.html'))) {
  const file = path.join(SITE, p);
  const before = fs.readFileSync(file, 'utf8');
  const after = before
    .replace(/(sha256:\s*')[0-9A-Fa-f]{64}(')/g, `$1${sha}$2`)
    .replace(/(sizeMB:\s*)\d+/g, `$1${sizeMB}`)
    // The link is the same kind of fact as the checksum: mechanical, derived from the
    // file that was just built, and a 404 for every visitor if it is left behind.
    .replace(/downloads\/Portico-Setup-[^"']+\.exe/g, `downloads/${path.basename(dest)}`)
    // The version people read on the page, so it cannot disagree with what they download.
    // Each pattern is anchored to a phrase that only ever means "the current release" —
    // a bare "Version 1.2.3" is left alone, because that is how the changelog names its
    // own history and rewriting those would erase it.
    .replace(/Portico[- ]v?\d+\.\d+\.\d+/g, (m) => m.replace(/\d+\.\d+\.\d+/, VERSION))
    .replace(/(Applies to version\s*)\d+\.\d+\.\d+/g, `$1${VERSION}`)
    .replace(/(Current:\s*v?)\d+\.\d+\.\d+/g, `$1${VERSION}`)
    .replace(/(Version\s*)\d+\.\d+\.\d+(\s*is current)/g, `$1${VERSION}$2`)
    .replace(/(version:\s*')\d+\.\d+\.\d+(')/g, `$1${VERSION}$2`)
    // structured data: what search engines and assistants read instead of the page
    .replace(/("softwareVersion":\s*")\d+\.\d+\.\d+(")/g, `$1${VERSION}$2`)
    .replace(/("downloadUrl":\s*"[^"]*\/)Portico-Setup-[\d.]+\.exe(")/g, `$1${path.basename(dest)}$2`);
  if (after !== before) { fs.writeFileSync(file, after); stamped++; }
}
console.log(`    sha256    : ${sha}`);
console.log(`    stamped   : ${stamped} page(s) updated with checksum, size, link and version`);

// A sitemap whose dates never move tells a crawler the site never changes, which is
// the opposite of what a release means. Take each date from the page's own file.
const smPath = path.join(SITE, 'sitemap.xml');
if (fs.existsSync(smPath)) {
  let sm = fs.readFileSync(smPath, 'utf8');
  let dated = 0;
  sm = sm.replace(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g, (whole, loc, rest) => {
    const name = (loc.split('/').pop() || 'index.html') || 'index.html';
    const file = path.join(SITE, name.includes('.') ? name : name + '.html');
    if (!fs.existsSync(file)) return whole;
    const day = fs.statSync(file).mtime.toISOString().slice(0, 10);
    dated++;
    return rest.includes('<lastmod>')
      ? whole.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${day}</lastmod>`)
      : whole.replace('</loc>', `</loc>\n    <lastmod>${day}</lastmod>`);
  });
  fs.writeFileSync(smPath, sm);
  console.log(`    sitemap   : ${dated} url(s) dated from the pages themselves`);
}

// the site links by filename, so a mismatch would 404 for every visitor
const pages = fs.readdirSync(path.join(ROOT, '..', 'portico-site')).filter((f) => f.endsWith('.html'));
const wanted = `downloads/${path.basename(dest)}`;
const stale = [];
for (const p of pages) {
  const html = fs.readFileSync(path.join(ROOT, '..', 'portico-site', p), 'utf8');
  const links = [...html.matchAll(/downloads\/(Portico-Setup-[^"']+\.exe)/g)].map((m) => m[1]);
  if (links.some((l) => l !== path.basename(dest))) stale.push(p);
}
if (stale.length) {
  console.log(`\n  WARNING: these pages still link to a different file: ${stale.join(', ')}`);
  console.log(`  They should point at ${wanted}\n`);
  process.exit(1);
}
console.log(`    links     : all pages point at ${wanted}\n`);
