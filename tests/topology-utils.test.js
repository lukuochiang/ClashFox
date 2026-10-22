'use strict';

const test = require('node:test');
const assert = require('node:assert');

const t = require('../src/ui/utils/topology-utils.js');

test('escapeTopologyText / escapeTopologyXml: HTML entities', () => {
  assert.strictEqual(t.escapeTopologyText(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  assert.strictEqual(t.escapeTopologyXml('a<b'), 'a&lt;b');
  assert.strictEqual(t.escapeTopologyText(''), '');
  assert.strictEqual(t.escapeTopologyText(null), '');
});

test('truncateTopologyLabel: keeps short, ellipsizes long', () => {
  assert.strictEqual(t.truncateTopologyLabel('short', 24), 'short');
  assert.strictEqual(t.truncateTopologyLabel('  spaced  ', 24), 'spaced');
  assert.strictEqual(t.truncateTopologyLabel('abcdefghij', 5), 'abcd…');
  assert.strictEqual(t.truncateTopologyLabel('x'.repeat(30), 24).length, 24);
});

test('clampTopologyNumber: bounds', () => {
  assert.strictEqual(t.clampTopologyNumber(5, 0, 10), 5);
  assert.strictEqual(t.clampTopologyNumber(-1, 0, 10), 0);
  assert.strictEqual(t.clampTopologyNumber(99, 0, 10), 10);
});

test('estimateTopologyNodeWidth: per-column clamping', () => {
  const w = t.estimateTopologyNodeWidth('source', 'A'.repeat(100), '');
  assert.ok(w >= 118 && w <= 220, `source width clamped: ${w}`);
  const small = t.estimateTopologyNodeWidth('target', '', '');
  assert.ok(small >= 86 && small <= 126, `target width clamped: ${small}`);
});

test('estimateTopologyNodeHeight: within bounds, target minimum 18', () => {
  const target = t.estimateTopologyNodeHeight('target', 'some long title here for lines', 'sub');
  assert.ok(target >= 18 && target <= 72, `target height: ${target}`);
  const src = t.estimateTopologyNodeHeight('source', 'x'.repeat(80), 'y'.repeat(80));
  assert.ok(src <= 96, `source height capped at 96: ${src}`);
});

test('buildTopologyColumnLayout: assigns top/height/centerY/boxWidth, monotonic cursor', () => {
  const rows = [
    { label: 'a', weight: 1 },
    { label: 'b', weight: 2, subLabel: 'bb' },
  ];
  const out = t.buildTopologyColumnLayout(rows, 'rule', 286, 6);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].columnKey, 'rule');
  assert.ok(out[1].top >= out[0].top);
  out.forEach((node) => {
    assert.ok(Number.isFinite(node.centerY));
    assert.ok(node.height > 0);
    assert.ok(node.boxWidth > 0);
  });
});

test('buildTopologyBandPathFromAnchors: bezier string', () => {
  const path = t.buildTopologyBandPathFromAnchors(0, 100, 10, 20);
  assert.ok(path.startsWith('M 0 10 C '));
  assert.ok(path.endsWith(', 100 20'));
});

test('aggregateTopologyStageLinks: sums hits, keeps max at, drops empty keys', () => {
  const rows = [
    { src: 'a', dst: 'b', hits: 2, at: 10 },
    { src: 'a', dst: 'b', hits: 3, at: 40 },
    { src: 'a', dst: '', hits: 5 },
    { src: '', dst: 'c', hits: 5 },
  ];
  const agg = t.aggregateTopologyStageLinks(rows, 'src', 'dst');
  assert.strictEqual(agg.length, 1);
  assert.strictEqual(agg[0].fromId, 'a');
  assert.strictEqual(agg[0].toId, 'b');
  assert.strictEqual(agg[0].hits, 5);
  assert.strictEqual(agg[0].at, 40);
});

test('allocateTopologyLinkSlots: allocates centerY per node between top and bottom', () => {
  const nodes = [{ id: 'n1', top: 0, height: 100, centerY: 50 }];
  const links = [
    { key: 'l1', from: 'n1', sortCenterY: 10 },
    { key: 'l2', from: 'n1', sortCenterY: 20 },
  ];
  const alloc = t.allocateTopologyLinkSlots(links, nodes, 'from');
  assert.strictEqual(alloc.size, 2);
  alloc.forEach((value) => {
    assert.ok(value.centerY >= 1.5 && value.centerY <= 98.5, `centerY in range: ${value.centerY}`);
  });
  // unknown node id -> not allocated
  const alloc2 = t.allocateTopologyLinkSlots([{ key: 'x', from: 'missing' }], nodes, 'from');
  assert.strictEqual(alloc2.size, 0);
});
