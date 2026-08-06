'use strict';
/**
 * What machine is this, and what should the app do about it?
 *
 * Portico's defaults used to be the numbers that happened to work on the laptop it
 * was written on — a context size, an image quantisation chosen because fp16 would
 * not fit in 4 GB, a device index pinned to the first Vulkan adapter. On a desktop
 * with 64 GB and a 24 GB card those choices leave most of the machine unused; on an
 * 8 GB laptop with no discrete GPU some of them do not fit at all.
 *
 * This module answers two separate questions and keeps them apart:
 *
 *   profile()   what is actually here — RAM, cores, GPUs, VRAM
 *   recommend() what to set, given a budget
 *
 * The split matters because the budget is not always the truth. Detection can be
 * wrong (a powered-down laptop GPU reports its full VRAM), a user may want to leave
 * headroom for other work, and someone setting the app up for a different machine
 * needs to describe hardware they are not sitting at. So recommend() takes a budget
 * rather than reading the machine itself, and the caller decides where it came from.
 */
const os = require('os');

const MB = 1024 * 1024;
const GB = 1024 * MB;

// GPU names, by class. Used only to describe and to order — never to decide alone,
// because the name says nothing about whether the card is powered up right now.
const DISCRETE = /geforce|rtx|gtx|quadro|tesla|radeon (rx|pro|vii)|instinct|arc a|arc b/i;
const INTEGRATED = /\(tm\) graphics|iris|uhd|hd graphics|vega \d+ graphics|apple m\d|adreno|mali/i;

function classifyGpu(name) {
  if (DISCRETE.test(name)) return 'discrete';
  if (INTEGRATED.test(name)) return 'integrated';
  return 'unknown';
}

/**
 * What the machine reports about itself.
 *
 * `devices` comes from the engine (llama.cpp --list-devices) rather than from here,
 * because the engine is the thing that has to allocate on them; passing it in also
 * keeps this module testable with any hardware you care to describe.
 */
function profile(devices = []) {
  const ramTotalGB = os.totalmem() / GB;
  const ramFreeGB = os.freemem() / GB;
  const cpus = os.cpus() || [];

  const gpus = devices.map((d) => ({
    id: d.id,
    name: d.name,
    kind: classifyGpu(d.name || ''),
    vramTotalGB: (d.totalMiB || 0) / 1024,
    vramFreeGB: (d.freeMiB || 0) / 1024,
  }));

  // The best card is the one with the most free VRAM. Class only breaks ties: a
  // discrete card with less free memory than the integrated one is not the better
  // choice for fitting a model, whatever its badge says.
  const best = gpus.slice().sort((a, b) => (
    b.vramFreeGB - a.vramFreeGB
    || (a.kind === 'discrete' ? -1 : 1) - (b.kind === 'discrete' ? -1 : 1)
  ))[0] || null;

  return {
    ramTotalGB: round1(ramTotalGB),
    ramFreeGB: round1(ramFreeGB),
    cores: cpus.length || 1,
    cpuModel: (cpus[0] && cpus[0].model || '').trim(),
    arch: process.arch,
    platform: process.platform,
    gpus,
    bestGpuId: best ? best.id : null,
    vramGB: best ? round1(best.vramTotalGB) : 0,
    vramFreeGB: best ? round1(best.vramFreeGB) : 0,
    hasGpu: gpus.length > 0,
  };
}

/**
 * The memory a model may actually use, in GB.
 *
 * Weights can live in VRAM or in system RAM, and llama.cpp will spill from one to
 * the other, so the budget is the larger of the two rather than their sum — counting
 * both would promise room that no single allocation can use.
 *
 * The reserves are the part people get wrong. An 8 GB machine does not have 8 GB
 * for a model: the OS, the browser engine this app is built on, and whatever else is
 * open all want some. Reserving a flat number would leave a 64 GB workstation
 * needlessly idle, so it scales.
 */
function budgetGB(p) {
  // Windows plus this app is already a couple of gigabytes before a model loads, so
  // small machines need a floor; large ones do not need a quarter of 128 GB held
  // back, hence the cap.
  const osReserve = Math.min(8, Math.max(3, p.ramTotalGB * 0.25));
  const ramBudget = Math.max(0.5, p.ramTotalGB - osReserve);

  // On Apple Silicon — and anywhere else the card reports most of system memory as
  // its own — RAM and VRAM are the same pool. Taking the larger of the two would
  // count that memory twice and leave the OS with almost nothing.
  if (isUnifiedMemory(p)) return round1(ramBudget);

  // A discrete card also has to hold the compositor and whatever is on screen.
  const vramBudget = p.vramGB > 0 ? Math.max(0, p.vramGB - Math.min(1.5, p.vramGB * 0.15)) : 0;
  return round1(Math.max(ramBudget, vramBudget));
}

/** Does the GPU share system memory rather than having its own? */
function isUnifiedMemory(p) {
  if (!p.vramGB) return false;
  const g = p.gpus.find((x) => x.id === p.bestGpuId) || p.gpus[0];
  if (g && /apple m\d/i.test(g.name || '')) return true;
  // an integrated GPU reporting close to the whole of RAM is carving it, not adding
  return p.vramGB >= p.ramTotalGB * 0.8;
}

/**
 * Settings for a machine with this much memory to spend.
 *
 * Everything here is a starting point the user can override; the point is that the
 * starting point follows the hardware instead of being one machine's numbers frozen
 * into the source.
 */
function recommend(p, budget = null) {
  const gb = budget == null ? budgetGB(p) : Number(budget);
  const vram = p.vramGB || 0;

  // Context costs memory that the weights then cannot have, and the cost climbs with
  // model size. These are deliberately conservative — running out mid-answer is a
  // far worse experience than a shorter window.
  let contextSize = 4096;
  if (gb >= 5) contextSize = 8192;
  if (gb >= 10) contextSize = 16384;
  if (gb >= 22) contextSize = 32768;

  // 99 is llama.cpp's "as many as fit". With no GPU, or a card too small to hold
  // anything useful, keep the work on the processor rather than thrashing across
  // the bus for a handful of layers.
  const gpuLayers = vram >= 2 ? 99 : 0;

  // Leave a core for the interface and the OS; past eight the returns fall off
  // sharply because memory bandwidth, not compute, is the limit.
  const threads = Math.max(2, Math.min(8, p.cores - 1));

  // Image generation is the one place where the old default was a hard-coded
  // workaround for a 4 GB card. fp16 is better when there is room for it.
  const imageQuant = vram >= 6 || (vram === 0 && gb >= 16) ? 'fp16' : 'q8_0';
  const imageSize = vram >= 8 || gb >= 24 ? 768 : 512;
  const imageSteps = gb >= 12 ? 25 : 18;

  // Every concurrent slot carves its own slice out of the context, so more slots on
  // a small machine means everyone gets a worse one.
  const parallelSlots = gb >= 24 ? 4 : gb >= 12 ? 2 : 1;

  return {
    budgetGB: round1(gb),
    contextSize,
    gpuLayers,
    threads,
    imageQuant,
    imageSize,
    imageSteps,
    parallelSlots,
    device: p.bestGpuId || 'auto',
  };
}

/**
 * Can this machine run a model of this size, and how comfortably?
 *
 * `sizeGB` is the file on disk; the running process needs that plus room for the
 * context, so the comparison is against the budget with a margin, not against the
 * raw number.
 */
function fit(sizeGB, budget) {
  const size = Number(sizeGB) || 0;
  if (!size || !budget) return { verdict: 'unknown', headroomGB: 0 };
  const headroom = round1(budget - size);
  if (headroom >= 2) return { verdict: 'comfortable', headroomGB: headroom };
  if (headroom >= 0) return { verdict: 'tight', headroomGB: headroom };
  return { verdict: 'too-large', headroomGB: headroom };
}

/** A short, plain description of the machine, for the interface and for logs. */
function describe(p) {
  const bits = [`${Math.round(p.ramTotalGB)} GB RAM`, `${p.cores} cores`];
  if (p.gpus.length) {
    const g = p.gpus.find((x) => x.id === p.bestGpuId) || p.gpus[0];
    bits.push(`${g.name} (${round1(g.vramTotalGB)} GB)`);
  } else {
    bits.push('no GPU detected');
  }
  return bits.join(' · ');
}

function round1(n) { return Math.round(n * 10) / 10; }

module.exports = { profile, budgetGB, recommend, fit, describe, classifyGpu, isUnifiedMemory };
