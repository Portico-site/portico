#!/usr/bin/env node
/**
 * Replaces the domain placeholder across the website in one step.
 *
 *   node scripts/set-site-domain.js portico.dev
 *   node scripts/set-site-domain.js portico.app --from portico.dev   (later change)
 *
 * The absolute URLs — canonical, og:url, og:image, the sitemap, robots.txt and the
 * JSON-LD — cannot be relative: social scrapers and search crawlers resolve them
 * without a base, so they have to name the real host. That means the host appears
 * in dozens of places, which is dozens of chances to miss one by hand.
 *
 * Only the placeholder is rewritten by default. Changing an already-set domain
 * needs --from, so github.com, huggingface.co and every other external link in
 * these pages can never be caught by accident.
 */
const fs = require('fs');
const path = require('path');

const PLACEHOLDER = 'REPLACE-WITH-YOUR-DOMAIN';
const SITE = path.join(__dirname, '..', '..', 'portico-site');
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const clean = (s) => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
const from = fromIdx === -1 ? PLACEHOLDER : clean(args[fromIdx + 1]);
const positional = args.filter((a, i) => fromIdx === -1 || (i !== fromIdx && i !== fromIdx + 1));
const domain = clean(positional[0]);

if (!domain || !DOMAIN_RE.test(domain)) {
  console.error('\n  Usage: node scripts/set-site-domain.js <domain> [--from <old-domain>]');
  console.error('  e.g.   node scripts/set-site-domain.js portico.dev\n');
  process.exit(1);
}
if (from !== PLACEHOLDER && !DOMAIN_RE.test(from)) {
  console.error(`\n  --from "${args[fromIdx + 1]}" does not look like a domain name.\n`);
  process.exit(1);
}
if (!fs.existsSync(SITE)) {
  console.error(`\n  No website folder at ${SITE}\n`);
  process.exit(1);
}

const needle = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
const files = fs.readdirSync(SITE).filter((f) => /\.(html|txt|xml)$/i.test(f));
let touched = 0;
let total = 0;

for (const f of files) {
  const p = path.join(SITE, f);
  const before = fs.readFileSync(p, 'utf8');
  const hits = (before.match(needle) || []).length;
  if (!hits) continue;
  fs.writeFileSync(p, before.replace(needle, domain));
  touched++;
  total += hits;
  console.log(`  ${f.padEnd(18)} ${hits}`);
}

if (!touched) {
  console.log(`\n  Nothing matched "${from}".`);
  console.log(from === PLACEHOLDER
    ? '  The domain has already been set — pass --from <old-domain> to change it.\n'
    : '\n');
  process.exit(0);
}

const left = files.reduce(
  (s, f) => s + (fs.readFileSync(path.join(SITE, f), 'utf8').split(PLACEHOLDER).length - 1), 0);
console.log(`\n  ${total} reference(s) in ${touched} file(s) now point at https://${domain}`);
console.log(`  Placeholders remaining: ${left}\n`);
