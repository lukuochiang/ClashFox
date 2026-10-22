(function initTopologyUtils(globalScope) {
  // Phase 3: pure topology text/geometry helpers, extracted verbatim from src/ui/js/app.js.
  // No DOM / state / module constants; safe to unit-test in Node via module.exports.

  function escapeTopologyText(value = '') {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeTopologyXml(value = '') {
    return escapeTopologyText(value);
  }

  function truncateTopologyLabel(value = '', maxLength = 24) {
    const text = String(value || '').trim();
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
  }

  function clampTopologyNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function estimateTopologyNodeWidth(columnKey = '', title = '', subtitle = '') {
    const basis = Math.max(String(title || '').length, Math.round(String(subtitle || '').length * 0.82));
    if (columnKey === 'source') {
      return clampTopologyNumber(84 + (basis * 5.5), 118, 220);
    }
    if (columnKey === 'rule') {
      return clampTopologyNumber(76 + (basis * 4.8), 100, 172);
    }
    if (columnKey === 'outbound') {
      return clampTopologyNumber(72 + (basis * 4.5), 92, 148);
    }
    return clampTopologyNumber(68 + (basis * 4.2), 86, 126);
  }

  function estimateTopologyNodeHeight(columnKey = '', title = '', subtitle = '', fallback = 22) {
    const titleLen = String(title || '').length;
    const subtitleLen = String(subtitle || '').length;
    const titleLines = columnKey === 'target'
      ? 1
      : Math.max(1, Math.min(2, Math.ceil(titleLen / (columnKey === 'source' ? 22 : 16))));
    const hasSubtitle = Boolean(String(subtitle || '').trim());
    const subtitleLines = hasSubtitle
      ? Math.max(1, Math.min(2, Math.ceil(subtitleLen / (columnKey === 'source' ? 20 : 18))))
      : 0;
    const vertical = 10 + (titleLines * 14) + (subtitleLines ? ((subtitleLines * 11) + 4) : 0) + 8;
    const minHeight = columnKey === 'target' ? 18 : fallback;
    const maxHeight = columnKey === 'source' ? 96 : (columnKey === 'rule' ? 86 : 72);
    return clampTopologyNumber(vertical, minHeight, maxHeight);
  }

  function buildTopologyColumnLayout(rows = [], columnKey = '', height = 286, gap = 6) {
    const normalizedWeights = rows.map((row) => Math.max(0.4, Math.pow(Math.max(1, Number(row.weight || 0)), 1.05)));
    const total = normalizedWeights.reduce((sum, weight) => sum + weight, 0) || rows.length || 1;
    const minHeight = columnKey === 'target' ? 14 : 22;
    const measuredHeights = rows.map((row) => estimateTopologyNodeHeight(columnKey, row.label || '', row.subLabel || '', minHeight));
    const fixedHeight = measuredHeights.reduce((sum, item) => sum + item, 0) + (Math.max(0, rows.length - 1) * gap);
    const availableHeight = Math.max(minHeight, height - Math.max(0, rows.length - 1) * gap);
    const totalNodeHeight = measuredHeights.reduce((sum, item) => sum + item, 0) + (Math.max(0, rows.length - 1) * gap);
    let cursorY = Math.max(0, Math.round((height - totalNodeHeight) / 2));
    return rows.map((row, index) => {
      const ratio = normalizedWeights[index] / total;
      const weightedHeight = Math.max(minHeight, Math.round(availableHeight * ratio));
      const measuredHeight = measuredHeights[index] || minHeight;
      const nodeHeight = fixedHeight <= height ? measuredHeight : Math.max(minHeight, Math.min(weightedHeight, measuredHeight));
      const nodeWidth = estimateTopologyNodeWidth(columnKey, row.label || '', row.subLabel || '');
      const next = {
        ...row,
        columnKey,
        top: cursorY,
        height: nodeHeight,
        centerY: cursorY + (nodeHeight / 2),
        boxWidth: nodeWidth,
      };
      cursorY += nodeHeight + gap;
      return next;
    });
  }

  function buildTopologyBandPathFromAnchors(fromX, toX, fromCenterY, toCenterY) {
    const x1 = fromX;
    const y1 = fromCenterY;
    const x2 = toX;
    const y2 = toCenterY;
    const dx = Math.max(18, (x2 - x1) * 0.34);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }

  function aggregateTopologyStageLinks(rows = [], fromKey = '', toKey = '') {
    const map = new Map();
    rows.forEach((row) => {
      const fromId = String(row?.[fromKey] || '');
      const toId = String(row?.[toKey] || '');
      if (!fromId || !toId) return;
      const aggregateKey = `${fromId}=>${toId}`;
      const next = map.get(aggregateKey) || {
        key: aggregateKey,
        fromId,
        toId,
        hits: 0,
        at: 0,
      };
      next.hits += Math.max(1, Number(row.hits || 1));
      next.at = Math.max(next.at, Number(row.at || 0));
      map.set(aggregateKey, next);
    });
    return Array.from(map.values());
  }

  function allocateTopologyLinkSlots(links = [], nodes = [], nodeField = '') {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const allocations = new Map();
    const groups = new Map();
    links.forEach((link) => {
      const nodeId = String(link?.[nodeField] || '');
      if (!nodeId) return;
      const bucket = groups.get(nodeId) || [];
      bucket.push(link);
      groups.set(nodeId, bucket);
    });
    groups.forEach((groupLinks, nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const sorted = groupLinks.slice().sort((a, b) => {
        const aSort = Number(a.sortCenterY ?? 0);
        const bSort = Number(b.sortCenterY ?? 0);
        if (aSort !== bSort) return aSort - bSort;
        const aHits = Number(a.hits || 0);
        const bHits = Number(b.hits || 0);
        if (aHits !== bHits) return bHits - aHits;
        return String(a.key || '').localeCompare(String(b.key || ''));
      });
      const padding = clampTopologyNumber(Math.round(node.height * 0.14), 2, 8);
      const startY = node.top + padding;
      const endY = node.top + node.height - padding;
      const usableSpan = Math.max(2, endY - startY);
      const slotStep = sorted.length > 1 ? usableSpan / (sorted.length - 1) : 0;
      sorted.forEach((link, index) => {
        const centerY = sorted.length === 1
          ? node.centerY
          : clampTopologyNumber(startY + (slotStep * index), node.top + 1.5, node.top + node.height - 1.5);
        allocations.set(link.key, { centerY });
      });
    });
    return allocations;
  }

  const api = {
    escapeTopologyText,
    escapeTopologyXml,
    truncateTopologyLabel,
    clampTopologyNumber,
    estimateTopologyNodeWidth,
    estimateTopologyNodeHeight,
    buildTopologyColumnLayout,
    buildTopologyBandPathFromAnchors,
    aggregateTopologyStageLinks,
    allocateTopologyLinkSlots,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (globalScope && typeof globalScope === 'object') {
    globalScope.CLASHFOX_TOPOLOGY_UTILS = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
