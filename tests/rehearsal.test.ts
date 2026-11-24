import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { calibrationItems, checkRenderings, leaked, liveItems, load, order, packet, page, presentationId, seed, type Attempt } from '../scripts/precision/rehearsal.js';

const loaded = await load(fileURLToPath(new URL('..', import.meta.url)));
const live = loaded.rehearsal.cases.filter(c => c.live);

test('seeds and IDs use the frozen protocol hash and the prompt is unchanged', async () => {
  const { FROZEN_PROTOCOL_SHA256 } = await import('../scripts/precision/rehearsal.js');
  assert.equal(loaded.protocolSha256, FROZEN_PROTOCOL_SHA256);
  assert.match(loaded.currentProtocolSha256, /^[0-9a-f]{64}$/);
});

test('fixtures load with matching source hashes and the protocol prompt', () => {
  assert.equal(live.length, 18);
  assert.match(loaded.prompt, /^You are reviewing one person's response/);
  assert.match(loaded.prompt, /Reply with JSON only:/);
});

test('the engine still renders exactly the frozen arm fields', async () => {
  assert.deepEqual(await checkRenderings(loaded), []);
});

test('arm A never shows the clarification and arm B always does', () => {
  for (const c of live) {
    const a = page(loaded, c, 'A');
    const b = page(loaded, c, 'B');
    assert.doesNotMatch(a, /class="clarification"/, c.id);
    assert.match(b, /class="clarification"/, c.id);
    if (c.armB?.question) {
      const q = c.armB.question.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      assert.ok(!a.includes(q), c.id);
      assert.ok(b.includes(q), c.id);
    }
    assert.ok(a.includes(presentationId(loaded.protocolSha256, c.id, 'A')));
    assert.match(a, new RegExp(`<html lang="${c.language}">`));
  }
});

test('pages escape markup from the source', () => {
  const c = live[0];
  const html = page({ ...loaded, material: new Map(loaded.material).set(c.id, { ...loaded.material.get(c.id)!, source: '<script>x</script>\n' }) }, c, 'B');
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;x'));
});

test('ordering is deterministic and differs by reviewer and run', () => {
  const items = calibrationItems(loaded, 'calibration');
  const r1 = order(items, seed(loaded.protocolSha256, 'calibration', 'R1', 1)).map(i => i.id);
  assert.deepEqual(order(items, seed(loaded.protocolSha256, 'calibration', 'R1', 1)).map(i => i.id), r1);
  assert.notDeepEqual(order(items, seed(loaded.protocolSha256, 'calibration', 'R2', 1)).map(i => i.id), r1);
  assert.notDeepEqual(order(items, seed(loaded.protocolSha256, 'calibration', 'R1', 2)).map(i => i.id), r1);
  assert.equal(new Set(r1).size, 72);
});

test('calibration packets carry no key, variant or arm', () => {
  const p = packet(loaded, 'calibration', 'R1', 1, calibrationItems(loaded, 'calibration'));
  const text = JSON.stringify(p);
  for (const banned of ['"key":', '"variant":', '"arm":', '"armA":', '"armB":', ':fills-slot', ':misses-slot', ':invented', ':preserves', ':breaks'])
    assert.ok(!text.includes(banned), banned);
  assert.equal(p.items.length, 72);
  assert.equal(calibrationItems(loaded, 'reserve').length, 24);
  assert.throws(() => packet(loaded, 'calibration', 'R1', 4, []));
});

test('controls show open slot none and ask cases show the slot', () => {
  const items = calibrationItems(loaded, 'calibration');
  const byCase = new Map(loaded.calibration.items.map((item, i) => [item.case, items[i]]));
  for (const c of loaded.rehearsal.cases)
    assert.equal(byCase.get(c.id)!.openSlot, c.outcome === 'ask' ? c.openSlot : 'none', c.id);
});

test('leakage needs five consecutive question words after normalisation', () => {
  const q = 'Which event ends the elapsed-time measurement?';
  assert.equal(leaked(q, 'The EVENT ends the elapsed time measurement at first paint.'), true);
  assert.equal(leaked(q, 'Which event ends it? When the first page is shown.'), false);
});

test('the live split applies consent, sanitization and completion, and keeps leak flags out of packets', () => {
  const c = live.find(x => x.armB?.question)!;
  const base = { caseId: c.id, arm: 'B' as const, presentationId: presentationId(loaded.protocolSha256, c.id, 'B'),
    completed: true, useful: 'yes' as const, consent: true, sanitization: 'pass' as const };
  const response = { action: 'edit' as const, scope: 'target line' as const, text: c.armB!.question, note: null };
  const attempts: Attempt[] = [
    { ...base, attempt: 1, response },
    { ...base, attempt: 2, response, consent: false },
    { ...base, attempt: 3, response, sanitization: 'withheld' },
    { ...base, attempt: 4, response: null, completed: false },
  ];
  const split = liveItems(loaded, attempts);
  assert.equal(split.sent.length, 1);
  assert.deepEqual(split.withheld.map(w => w.reason), ['no consent', 'sanitization', 'not completed']);
  assert.equal(split.leaks.length, 1);
  assert.ok(!JSON.stringify(packet(loaded, 'live', 'R1', 1, split.sent)).includes('leak'));
  assert.throws(() => liveItems(loaded, [{ ...base, attempt: 1, response, presentationId: '000000000000' }]));
  assert.throws(() => liveItems(loaded, [{ ...base, attempt: 1, response }, { ...base, attempt: 1, response }]));
  assert.throws(() => liveItems(loaded, [{ ...base, attempt: 1, response: { action: 'escalate', scope: null, text: null, note: null } }]));
});

test('run-2 calibration packets: 96 and 48 items, seeded from the run-2 pre-registration', async () => {
  const { calibrationItems, packet, seed, order } = await import('../scripts/precision/rehearsal.js');
  assert.ok(loaded.calibrationRun2 && loaded.run2ProtocolSha256);
  const cal = calibrationItems(loaded, 'calibration-run2');
  const res = calibrationItems(loaded, 'reserve-run2');
  assert.equal(cal.length, 96); assert.equal(res.length, 48);
  for (const lang of ['en', 'es']) {
    assert.equal(loaded.calibrationRun2!.items.filter(i => i.language === lang).length, 48);
    assert.equal(loaded.calibrationRun2!.reserve.filter(i => i.language === lang).length, 24);
  }
  const p = packet(loaded, 'calibration-run2', 'R1', 1, cal);
  assert.equal(p.runProtocolSha256, loaded.run2ProtocolSha256);
  assert.equal(p.seed, seed(loaded.run2ProtocolSha256!, 'calibration-run2', 'R1', 1));
  assert.deepEqual(p.items.map(i => i.id), order(cal, p.seed).map(i => i.id));
  const run1 = new Set(calibrationItems(loaded, 'calibration').map(i => i.id));
  assert.ok(cal.every(i => !run1.has(i.id)));
});
