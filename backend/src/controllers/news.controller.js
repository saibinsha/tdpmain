const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');

const LEADERS = [
  { id: 'cbn', name: 'N. Chandrababu Naidu' },
  { id: 'lokesh', name: 'Nara Lokesh' },
  { id: 'thippe_swamy', name: 'Gundumala Thippe Swamy' },
  { id: 'ms_raju', name: 'M.S. Raju' },
];

const LEADER_FALLBACK_IMAGES = {
  cbn: 'https://yt3.googleusercontent.com/OyHTN7U_Ub5iZR2qDDJ34uFWBQJ4VGolPIo1xE_0i-HeRapRLS8KccvZS9NviBLbjU18Pv8J=s900-c-k-c0x00ffffff-no-rj',
  lokesh: 'https://theleaderspage.com/wp-content/uploads/2020/07/nara-lokesh.jpg',
  thippe_swamy: 'https://s3.ap-southeast-1.amazonaws.com/images.deccanchronicle.com/dc-Cover-h888ii526o296qi4udif56da84-20230626233651.Medi.jpeg',
  ms_raju: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfcbsN7t1LnUerPviprD4Ver0GUc4nAPR4yQ&s',
};

function arr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function stripHtml(input) {
  if (!input) return '';
  return String(input).replace(/<[^>]*>/g, '').trim();
}

function decodeXml(input) {
  if (!input) return '';
  return String(input)
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n, 10)))
    .trim();
}

function matchTag(block, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m?.[1] ? decodeXml(m[1]) : null;
}

function matchTagAttr(block, tag, attr) {
  const re = new RegExp(`<${tag}\\b[^>]*${attr}=["']([^"']+)["'][^>]*\\/?\\s*>`, 'i');
  const m = block.match(re);
  return m?.[1] ? decodeXml(m[1]) : null;
}

function pickImageFromItem(item) {
  if (!item) return null;
  const mediaUrl = matchTagAttr(item, 'media:content', 'url');
  if (mediaUrl) return mediaUrl;

  const thumbUrl = matchTagAttr(item, 'media:thumbnail', 'url');
  if (thumbUrl) return thumbUrl;

  const encUrl = matchTagAttr(item, 'enclosure', 'url');
  if (encUrl) return encUrl;

  const desc = matchTag(item, 'description') || matchTag(item, 'content:encoded') || '';
  const d = decodeXml(desc);
  const m1 = String(d).match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
  if (m1?.[1]) return decodeXml(m1[1]);

  const m2 = String(d).match(/<img[^>]+(?:src|data-src)=([^\s>]+)[\s>]/i);
  if (m2?.[1]) return decodeXml(m2[1].replace(/^['"]|['"]$/g, ''));
  return null;
}

async function fetchRss(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'tdp-party-app/1.0',
        Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
      },
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new AppError(`Failed to fetch news feed (${res.status})`, 502);
    }

    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function parseGoogleNewsRss(xmlText, leaderId) {
  const items = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xmlText))) {
    items.push(m[1]);
  }

  return items
    .map((itemXml) => {
      const titleRaw = matchTag(itemXml, 'title');
      const title = stripHtml(titleRaw);
      const link = matchTag(itemXml, 'link');

      const pubDateRaw = matchTag(itemXml, 'pubDate');
      const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : null;

      const source = stripHtml(matchTag(itemXml, 'source')) || null;
      const sourceUrl = matchTagAttr(itemXml, 'source', 'url');

      const descriptionRaw = matchTag(itemXml, 'description') || '';
      const description = stripHtml(descriptionRaw);
      const imageUrl = pickImageFromItem(itemXml) || LEADER_FALLBACK_IMAGES[leaderId] || null;

      if (!title || !link) return null;

      return {
        leaderId,
        title,
        link,
        pubDate,
        source,
        sourceUrl: sourceUrl || null,
        description,
        imageUrl,
      };
    })
    .filter(Boolean);
}

const cache = new Map();

function getCacheKey(leaderId, limit) {
  return `${leaderId}:${limit}`;
}

const listLeadersNews = asyncHandler(async (req, res) => {
  const { leaderId, limit = 20 } = req.query;
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  const leaders = leaderId
    ? LEADERS.filter((x) => x.id === String(leaderId))
    : LEADERS;

  if (leaderId && leaders.length === 0) {
    throw new AppError('Invalid leaderId', 400);
  }

  const now = Date.now();
  const TTL_MS = 2 * 60 * 1000;

  const results = await Promise.all(
    leaders.map(async (leader) => {
      const key = getCacheKey(leader.id, l);
      const cached = cache.get(key);
      if (cached && now - cached.at < TTL_MS) {
        return { leaderId: leader.id, leaderName: leader.name, items: cached.items };
      }

      const q = encodeURIComponent(leader.name);
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;

      const xml = await fetchRss(url);
      const items = parseGoogleNewsRss(xml, leader.id).slice(0, l);

      cache.set(key, { at: now, items });

      return { leaderId: leader.id, leaderName: leader.name, items };
    })
  );

  const flat = results
    .flatMap((r) => r.items.map((it) => ({ ...it, leaderName: r.leaderName })))
    .sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

  res.json({ ok: true, leaders: results, items: flat });
});

module.exports = { listLeadersNews, LEADERS };
