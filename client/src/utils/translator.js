export const languageMap = {
  en: 'en',
  fi: 'fi',
  sv: 'sv',
  de: 'de',
  fr: 'fr',
  es: 'es',
  it: 'it',
  ja: 'ja',
  zh: 'zh',
  ru: 'ru',
  tr: 'tr',
  nl: 'nl',
  no: 'no',
  da: 'da',
  pl: 'pl',
  pt: 'pt'
};

const ENDPOINTS = [
  'https://libretranslate.com/translate',
  'https://libretranslate.de/translate'
];

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('translate failed');
  return res.json();
}

export async function translateBatch(strings, from, to) {
  const src = languageMap[from] || from || 'en';
  const tgt = languageMap[to] || to || 'fi';
  const unique = Array.from(new Set(strings));
  for (const ep of ENDPOINTS) {
    try {
      const data = await postJson(ep, { q: unique, source: src, target: tgt, format: 'text' });
      const out = Array.isArray(data) ? data.map(d => d.translatedText) : [data.translatedText];
      const mapping = {};
      unique.forEach((s, i) => { mapping[s] = out[i] || s; });
      return mapping;
    } catch (_) {
      continue;
    }
  }
  const fallback = {};
  unique.forEach(s => { fallback[s] = s; });
  return fallback;
}

export function collectTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const text = (node.nodeValue || '').trim();
      if (!text) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest('[data-keep="true"]')) return NodeFilter.FILTER_REJECT;
      if (/^https?:\/\//.test(text)) return NodeFilter.FILTER_REJECT;
      if (/^[0-9+\-()\s]+$/.test(text)) return NodeFilter.FILTER_REJECT; // numbers/phones
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let current;
  while ((current = walker.nextNode())) {
    nodes.push(current);
    if (nodes.length > 800) break;
  }
  return nodes;
}

