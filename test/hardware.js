// The point of hardware.js is that Portico stops being tuned for one laptop, so the
// test is a sweep across machines rather than a check against this one. No app and
// no CDP needed — the module is pure and takes the device list as an argument.
const hw = require('../src/main/hardware');
const { CATALOG } = require('../src/main/models');

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}${extra ? '\n        ' + extra : ''}`);
};

const gpu = (name, vramGB) => ({
  id: 'Vulkan0', name, kind: hw.classifyGpu(name),
  vramTotalGB: vramGB, vramFreeGB: vramGB * 0.9,
});
const machine = (ramGB, cores, gpus = []) => ({
  ramTotalGB: ramGB, ramFreeGB: ramGB * 0.6, cores,
  cpuModel: 'test', arch: 'x64', platform: 'win32',
  gpus, bestGpuId: gpus[0] ? gpus[0].id : null,
  vramGB: gpus[0] ? gpus[0].vramTotalGB : 0,
  vramFreeGB: gpus[0] ? gpus[0].vramFreeGB : 0,
  hasGpu: gpus.length > 0,
});

const MACHINES = [
  ['4 GB netbook, no GPU', machine(4, 2)],
  ['8 GB laptop, no GPU', machine(8, 4)],
  ['8 GB laptop + 2 GB integrated', machine(8, 8, [gpu('AMD Radeon(TM) Graphics', 2)])],
  ['16 GB + 4 GB discrete', machine(16, 8, [gpu('NVIDIA GeForce RTX 3050 Ti Laptop GPU', 4)])],
  ['16 GB + 8 GB discrete', machine(16, 12, [gpu('NVIDIA GeForce RTX 4060', 8)])],
  ['32 GB + 12 GB discrete', machine(32, 16, [gpu('NVIDIA GeForce RTX 4070', 12)])],
  ['64 GB + 24 GB discrete', machine(64, 32, [gpu('NVIDIA GeForce RTX 4090', 24)])],
  ['16 GB Apple, unified', machine(16, 10, [gpu('Apple M3', 16)])],
  ['64 GB Apple, unified', machine(64, 16, [gpu('Apple M3 Max', 64)])],
  ['128 GB server, no GPU', machine(128, 64)],
];

console.log('\n========== PERFIL POR MÁQUINA ==========\n');
console.log('  máquina                          presup   ctx   capas hilos  imagen      slots');
const results = MACHINES.map(([name, p]) => {
  const r = hw.recommend(p);
  console.log(
    '  ' + name.padEnd(32)
    + String(r.budgetGB).padStart(6)
    + String(r.contextSize).padStart(7)
    + String(r.gpuLayers).padStart(6)
    + String(r.threads).padStart(6)
    + ('  ' + r.imageQuant + ' ' + r.imageSize).padEnd(13)
    + String(r.parallelSlots).padStart(4));
  return { name, p, r };
});

console.log('\n========== INVARIANTES ==========\n');

// Nothing may recommend more memory than the machine has.
for (const { name, p, r } of results) {
  check(r.budgetGB < p.ramTotalGB, `${name}: the budget leaves room for the OS`,
    `${r.budgetGB} GB of ${p.ramTotalGB} GB`);
}

// Unified memory must not be counted twice.
const unified = results.filter(({ p }) => hw.isUnifiedMemory(p));
check(unified.length === 2, 'both Apple machines are recognised as unified memory',
  `${unified.length} detected`);
for (const { name, p, r } of unified) {
  check(r.budgetGB <= p.ramTotalGB - 3,
    `${name}: unified memory still reserves for the system`,
    `${r.budgetGB} GB of ${p.ramTotalGB} GB`);
}

// More of a resource may never mean less of a setting.
const ladder = results.filter(({ p }) => !hw.isUnifiedMemory(p))
  .sort((a, b) => a.r.budgetGB - b.r.budgetGB);
let monotonic = true;
for (let i = 1; i < ladder.length; i++) {
  if (ladder[i].r.contextSize < ladder[i - 1].r.contextSize) monotonic = false;
  if (ladder[i].r.parallelSlots < ladder[i - 1].r.parallelSlots) monotonic = false;
}
check(monotonic, 'a bigger machine never gets a smaller context or fewer slots');

// A machine with no usable GPU must not be told to offload layers to one.
for (const { name, p, r } of results) {
  if (p.vramGB < 2) {
    check(r.gpuLayers === 0, `${name}: no GPU offload without a usable card`,
      `gpuLayers ${r.gpuLayers}`);
  }
}

// Thread count must leave something for the interface, and not run away on a
// machine with 64 cores where memory bandwidth is the limit anyway.
for (const { name, p, r } of results) {
  check(r.threads >= 2 && r.threads <= 8 && r.threads < Math.max(3, p.cores),
    `${name}: thread count is sane`, `${r.threads} of ${p.cores} cores`);
}

console.log('\n========== QUÉ MODELOS ENTRAN ==========\n');

for (const { name, r } of results) {
  const v = CATALOG.map((m) => hw.fit(m.sizeGB, r.budgetGB).verdict);
  const ok = v.filter((x) => x === 'comfortable').length;
  const tight = v.filter((x) => x === 'tight').length;
  const no = v.filter((x) => x === 'too-large').length;
  const biggest = CATALOG
    .filter((m) => hw.fit(m.sizeGB, r.budgetGB).verdict !== 'too-large')
    .sort((a, b) => b.sizeGB - a.sizeGB)[0];
  console.log(`  ${name.padEnd(32)} ${String(ok).padStart(2)} cómodos, ${String(tight).padStart(2)} justos, ${String(no).padStart(2)} no caben`
    + `  ·  mayor: ${biggest ? biggest.name + ' (' + biggest.sizeGB + ' GB)' : 'ninguno'}`);
}

// The verdicts have to agree with the guidance the website gives.
const at = (gb) => {
  const b = hw.recommend(machine(gb, 8)).budgetGB;
  return CATALOG.filter((m) => hw.fit(m.sizeGB, b).verdict !== 'too-large')
    .sort((a, c) => c.sizeGB - a.sizeGB)[0];
};
console.log('');
check(at(8) && at(8).sizeGB <= 6, '8 GB machines are offered small models only',
  at(8) ? `largest ${at(8).sizeGB} GB` : 'none');
check(at(16) && at(16).sizeGB >= 8 && at(16).sizeGB <= 12,
  '16 GB machines reach the 7–9 GB models', at(16) ? `largest ${at(16).sizeGB} GB` : 'none');
check(at(64) && at(64).sizeGB >= 40, '64 GB machines reach the largest model',
  at(64) ? `largest ${at(64).sizeGB} GB` : 'none');

// Every catalogue entry needs a size, or the verdict is meaningless.
const missing = CATALOG.filter((m) => !Number(m.sizeGB));
check(missing.length === 0, 'every catalogue entry declares a size',
  missing.map((m) => m.id).join(', '));

console.log('\n========== SIN REFERENCIAS A UNA MÁQUINA CONCRETA ==========\n');
const fs = require('fs');
const path = require('path');
const NAMED = /3050 Ti|RTX \d|GeForce [A-Z]|Radeon\(TM\)|C:\\\\Users\\\\[a-z]/i;
const srcDir = path.join(__dirname, '..', 'src');
const offenders = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) { if (f !== 'vendor') walk(full); continue; }
    if (!/\.(js|html|css)$/.test(f)) continue;
    const text = fs.readFileSync(full, 'utf8');
    text.split('\n').forEach((line, i) => {
      // the classifier regexes legitimately name vendors; skip those
      if (/DISCRETE|INTEGRATED|const discrete|const integrated/.test(line)) return;
      if (NAMED.test(line)) offenders.push(`${path.relative(srcDir, full)}:${i + 1}  ${line.trim().slice(0, 70)}`);
    });
  }
})(srcDir);
check(offenders.length === 0, 'no source file names one particular computer',
  offenders.join('\n        '));

console.log(`\n====================================`);
console.log(`RESULTADO: ${fails === 0 ? 'todo correcto' : fails + ' FALLOS'}`);
console.log(`====================================\n`);
process.exit(fails ? 1 : 0);
