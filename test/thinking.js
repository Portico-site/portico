/* Portico thinking-display tests.
 *
 * Pulls renderMd() out of the renderer and runs it against stubs, so the markup of the
 * live <think> block can be checked without building or launching anything:
 *
 *   node test/thinking.js
 */
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'src', 'renderer', 'app.js');
const src = fs.readFileSync(APP, 'utf8');
const body = src.match(/function renderMd\(md, meta\) \{[\s\S]*?\n\}/)[0];
const tokFn = src.match(/^const CHARS_PER_TOKEN = .*$/m)[0] + '\n' + src.match(/^const tok = .*$/m)[0];
const answerFn = src.match(/function answerOnly\(text\) \{[\s\S]*?\n\}/)[0];
const answerOnly = new Function(answerFn + '\nreturn answerOnly;')();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const marked = { parse: (s) => s };                 // identity: we want the raw block
const DOMPurify = { sanitize: (s) => s };
const renderMd = new Function('esc', 'marked', 'DOMPurify', tokFn + '\n' + body + '\nreturn renderMd;')(esc, marked, DOMPurify);

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (got ? '\n        got: ' + String(got).slice(0, 300) : '')); }
};

// --- open tag, still arriving ---
let out = renderMd('<think>Let me work out the sum step by step', { thinkMs: 4200 });
ok('live block is open', /<details class="think is-live" open>/.test(out), out);
ok('live label shimmers', /class="think-lab live">Thinking/.test(out), out);
ok('live label has three dots', (out.match(/<i><\/i>/g) || []).length === 3, out);
ok('meter shows tokens and seconds', /class="think-meter">\d+ tokens · 4s</.test(out), out);
ok('reasoning text is visible', out.includes('Let me work out the sum'), out);

// --- closed tag ---
out = renderMd('<think>Two plus two is four.</think>The answer is 4.', { thinkMs: 4200 });
ok('closed block is folded', /<details class="think"><summary>/.test(out) && !/ open>/.test(out), out);
ok('closed label states the cost', /Thought for \d+ tokens · 4s</.test(out), out);
ok('no live class when closed', !out.includes('is-live'), out);
ok('answer survives outside the block', out.includes('The answer is 4.'), out);

// --- time formatting ---
ok('under a second reads 0s', /· 0s</.test(renderMd('<think>x', { thinkMs: 400 })), null);
ok('minutes are split out', /· 1m 4s</.test(renderMd('<think>x', { thinkMs: 64000 })), null);
ok('no clock when never timed', !renderMd('<think>x', {}).includes('·'), null);
ok('missing meta does not throw', renderMd('<think>x').includes('Thinking'), null);

// --- the blank-line trap ---
out = renderMd('<think>First idea.\n\nSecond idea.</think>Done.', { thinkMs: 1000 });
const block = out.match(/<details[\s\S]*?<\/details>/)[0];
ok('block survives a blank line in the reasoning', !block.includes('\n'), JSON.stringify(block));
ok('both paragraphs kept, joined by <br>', block.includes('First idea.<br><br>Second idea.'), block);

// --- escaping ---
out = renderMd('<think>Try <img src=x onerror=alert(1)> and "quotes"</think>ok', {});
ok('markup in the reasoning is escaped', out.includes('&lt;img src=x') && !out.includes('<img'), out);

// --- empty and malformed ---
ok('empty closed block disappears', renderMd('<think></think>hi', {}).trim() === 'hi', null);
ok('no think tag is untouched', renderMd('plain text', {}) === 'plain text', null);
out = renderMd('<think>a</think>mid<think>b', { thinkMs: 900 });
ok('two blocks, second still live', (out.match(/<details/g) || []).length === 2 && out.includes('is-live'), out);

// --- one clock per block ---
out = renderMd('<think>first thought</think>then<think>second thought</think>done', { thinkMs: [3000, 65000] });
ok('each block reports its own time', /Thought for \d+ tokens · 3s</.test(out) && /Thought for \d+ tokens · 1m 5s</.test(out), out);
out = renderMd('<think>first</think>then<think>still going', { thinkMs: [3000, 2000] });
ok('a live second block times itself', /Thought for \d+ tokens · 3s</.test(out) && /think-meter">\d+ tokens · 2s</.test(out), out);
ok('a block with no recorded time simply omits it', !/·\s*\d+s/.test(renderMd('<think>a</think>b<think>c</think>d', { thinkMs: [] })), null);

// --- what leaves the reply: the clipboard, and the history sent back to the engine ---
ok('the reasoning is taken out',
  answerOnly('<think>Nobody should see this.</think>The answer is 4.') === 'The answer is 4.',
  answerOnly('<think>Nobody should see this.</think>The answer is 4.'));
ok('an unclosed thought is taken out too',
  answerOnly('Partial answer.\n<think>still going') === 'Partial answer.',
  answerOnly('Partial answer.\n<think>still going'));
ok('several thoughts all go',
  answerOnly('<think>a</think>One.<think>b</think>Two.') === 'One.Two.',
  answerOnly('<think>a</think>One.<think>b</think>Two.'));
ok('a reply that is only reasoning keeps it rather than vanishing',
  answerOnly('<think>the model never got to an answer</think>') === 'the model never got to an answer',
  answerOnly('<think>the model never got to an answer</think>'));
ok('stray tags do not survive the fallback', !/<\/?think>/.test(answerOnly('<think>only this')), answerOnly('<think>only this'));
ok('a reply with no thinking is untouched', answerOnly('Just an answer.') === 'Just an answer.');
ok('empty input is safe', answerOnly('') === '' && answerOnly(null) === '' && answerOnly(undefined) === '');

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
