'use strict';

// IP / network-detail response parsers, extracted verbatim from src/main.js (Phase 2).
// Pure data transforms (string/JSON in -> structured object out); no electron/fs/network.

function extractIpFromPayload(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }
  try {
    const parsed = JSON.parse(text);
    const directCandidates = [
      parsed && parsed.ip,
      parsed && parsed.address,
      parsed && parsed.query,
      parsed && parsed.data && parsed.data.ip,
      parsed && parsed.data && parsed.data.address,
      parsed && parsed.ipip && parsed.ipip.ip,
    ];
    for (const candidate of directCandidates) {
      const value = String(candidate || '').trim();
      if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
        return value;
      }
    }
  } catch {}
  const match = text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  return match && match[0] ? String(match[0]).trim() : '';
}

function parseNetworkDetailPayload(raw = '', endpoint = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return { ip: '', detail: '', source: endpoint };
  }
  const cleanNetworkText = (value = '') => String(value || '').replace(/^[,\s，]+|[,\s，]+$/g, '').trim();
  const ip = extractIpFromPayload(text);
  try {
    const parsed = JSON.parse(text);
    const city = cleanNetworkText(
      (parsed && parsed.city)
      || (parsed && parsed.location && parsed.location.city)
      || (parsed && parsed.data && parsed.data.city)
      || '',
    );
    const region = cleanNetworkText(
      (parsed && parsed.region)
      || (parsed && parsed.location && parsed.location.region)
      || (parsed && parsed.data && parsed.data.region)
      || '',
    );
    const country = cleanNetworkText(
      (parsed && parsed.country)
      || (parsed && parsed.location && parsed.location.country)
      || (parsed && parsed.data && parsed.data.country)
      || '',
    );
    const locationText = cleanNetworkText(
      (parsed && typeof parsed.location === 'string' && parsed.location)
      || (parsed && parsed.data && parsed.data.location)
      || '',
    );
    const isp = cleanNetworkText(
      (parsed && parsed.isp)
      || (parsed && parsed.organization)
      || (parsed && parsed.as)
      || (parsed && parsed.asn && (parsed.asn.org || parsed.asn.name))
      || (parsed && parsed.company && parsed.company.name)
      || (parsed && parsed.data && (parsed.data.isp || parsed.data.org))
      || '',
    );
    const locationParts = [country, region, city].filter(Boolean);
    const summary = [locationParts.join(' ') || locationText, isp].filter(Boolean).join(' · ');
    return {
      ip,
      detail: summary || '',
      source: endpoint,
    };
  } catch {
    return {
      ip,
      detail: '',
      source: endpoint,
    };
  }
}

function parseIpapiMetaPayload(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    return {
      originalIp: '',
      nativeIp: null,
      riskScore: null,
      riskLevel: '',
    };
  }
  try {
    const parsed = JSON.parse(text);
    const originalIp = String((parsed && parsed.ip) || '').trim();
    const bogon = Boolean(parsed && parsed.is_bogon);
    const datacenter = Boolean(parsed && parsed.is_datacenter);
    const tor = Boolean(parsed && parsed.is_tor);
    const proxy = Boolean(parsed && parsed.is_proxy);
    const vpn = Boolean(parsed && parsed.is_vpn);
    const abuser = Boolean(parsed && parsed.is_abuser);
    const crawler = Boolean(parsed && parsed.is_crawler);
    const mobile = Boolean(parsed && parsed.is_mobile);
    const riskScore = Math.min(100, Math.max(0,
      (bogon ? 40 : 0)
      + (datacenter ? 25 : 0)
      + (tor ? 20 : 0)
      + (proxy ? 20 : 0)
      + (vpn ? 20 : 0)
      + (abuser ? 25 : 0)
      + (crawler ? 10 : 0)
      + (mobile ? 6 : 0)
    ));
    const riskLevel = riskScore >= 60 ? 'high' : (riskScore >= 30 ? 'medium' : 'low');
    const nativeIp = !(bogon || datacenter || tor || proxy || vpn || abuser || crawler);
    return {
      originalIp,
      nativeIp,
      riskScore,
      riskLevel,
    };
  } catch {
    return {
      originalIp: '',
      nativeIp: null,
      riskScore: null,
      riskLevel: '',
    };
  }
}

module.exports = {
  extractIpFromPayload,
  parseNetworkDetailPayload,
  parseIpapiMetaPayload,
};
