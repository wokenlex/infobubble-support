'use strict';

// Average article length (characters) -> label, same buckets as in the app.
const LENGTHS = [
  { id: 'headlines', label: 'Headlines', test: (n) => n != null && n < 500 },
  { id: 'summaries', label: 'Summaries', test: (n) => n != null && n >= 500 && n < 2500 },
  { id: 'long', label: 'Long reads', test: (n) => n != null && n >= 2500 },
];
const ROW_HEIGHT = 56;
const MAX_PREVIEW_FEEDS = 8;
const FETCH_TIMEOUT = 12000;

// Most feeds don't send CORS headers, so after a direct attempt we go through public services.
// Optional own proxy (e.g. a Cloudflare Worker) that returns the feed body for `?url=`; tried first when set.
const OWN_PROXY = 'https://little-star-19a1.khj579g5dn.workers.dev/?url=';
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const RAW_PROXIES = [
  (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const langNames = (() => {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }); } catch { return null; }
})();
const langName = (code) => { try { return langNames?.of(code) || code; } catch { return code; } };

const state = {
  mode: 'channels',
  country: -1,
  categories: new Set(),
  lengths: new Set(),
  languages: new Set(),
  sort: 'top',
  query: '',
  countryQuery: '',
  selected: null,
  // Domains picked for export, per mode (a domain's channels and podcasts are separate picks).
  picked: { channels: new Set(), podcasts: new Set() },
};
const picked = () => state.picked[state.mode];

let DB = null;      // raw catalog
let rows = [];      // domains matching all filters (current view)

// ---------------------------------------------------------------- data

function feedsOf(d, mode = state.mode) {
  const podcast = mode === 'podcasts' ? 1 : 0;
  const out = [];
  for (const [cat, isPod, urls] of d.groups) if (isPod === podcast) for (const u of urls) out.push({ url: u, cat });
  return out;
}

function prepare(raw) {
  const domains = raw.domains.map(([host, country, rank, avgLen, langs, groups]) => {
    const d = { host, hostLC: host.toLowerCase(), country, rank, avgLen, langs, groups };
    d.channelCats = [...new Set(groups.filter((g) => !g[1]).map((g) => g[0]))];
    d.podcastCats = [...new Set(groups.filter((g) => g[1]).map((g) => g[0]))];
    d.channelCount = groups.reduce((n, g) => n + (g[1] ? 0 : g[2].length), 0);
    d.podcastCount = groups.reduce((n, g) => n + (g[1] ? g[2].length : 0), 0);
    d.lengthId = (LENGTHS.find((l) => l.test(avgLen)) || {}).id || null;
    return d;
  });
  return { ...raw, domains };
}

function matches(d, ignoreCountry) {
  const pod = state.mode === 'podcasts';
  if ((pod ? d.podcastCount : d.channelCount) === 0) return false;
  if (!ignoreCountry && state.country >= 0 && d.country !== state.country) return false;
  if (state.categories.size && !(pod ? d.podcastCats : d.channelCats).some((c) => state.categories.has(c))) return false;
  if (state.lengths.size && !state.lengths.has(d.lengthId)) return false;
  if (state.languages.size && !d.langs.some((l) => state.languages.has(l))) return false;
  if (state.query && !d.hostLC.includes(state.query)) return false;
  return true;
}

const sorters = {
  top: (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.hostLC.localeCompare(b.hostLC),
  az: (a, b) => a.hostLC.localeCompare(b.hostLC),
  feeds: (a, b) => count(b) - count(a) || sorters.top(a, b),
};
const count = (d) => (state.mode === 'podcasts' ? d.podcastCount : d.channelCount);

function applyFilters() {
  const perCountry = new Array(DB.countries.length).fill(0);
  let total = 0;
  rows = [];
  for (const d of DB.domains) {
    if (!matches(d, true)) continue;
    perCountry[d.country]++;
    total++;
    if (state.country < 0 || d.country === state.country) rows.push(d);
  }
  rows.sort(sorters[state.sort]);
  renderCountries(perCountry, total);
  renderList(true);
  renderPills();
  $('shown').textContent = rows.length.toLocaleString('en') + ' shown';
  renderExport();
}

// ---------------------------------------------------------------- countries

let countryCounts = [];
function renderCountries(perCountry, total) {
  countryCounts = perCountry;
  const q = state.countryQuery;
  const html = [`<li class="all${state.country < 0 ? ' on' : ''}" data-i="-1"><span>All Countries</span><span>${total.toLocaleString('en')}</span></li>`];
  DB.countries.forEach((name, i) => {
    if (q && !name.toLowerCase().includes(q)) return;
    const n = perCountry[i];
    html.push(`<li class="${state.country === i ? 'on' : ''}${n ? '' : ' zero'}" data-i="${i}"><span>${esc(name)}</span><span>${n.toLocaleString('en')}</span></li>`);
  });
  $('countries').innerHTML = html.join('');

  const sel = $('countrySelect');
  sel.innerHTML = `<option value="-1">All Countries (${total})</option>` +
    DB.countries.map((name, i) => `<option value="${i}">${esc(name)} (${perCountry[i]})</option>`).join('');
  sel.value = String(state.country);
}

// ---------------------------------------------------------------- virtual list

const list = $('list');
const spacer = $('spacer');
let rendered = new Map();

function rowHTML(d) {
  const cats = (state.mode === 'podcasts' ? d.podcastCats : d.channelCats).map((c) => DB.categories[c]);
  const len = LENGTHS.find((l) => l.id === d.lengthId);
  const sub = [DB.countries[d.country], len && len.label, ...cats].filter(Boolean).join(' · ');
  const langs = d.langs.slice(0, 3).map((l) => `<span class="badge">${esc(DB.languages[l].toUpperCase())}</span>`).join('');
  return `<button class="pick" title="Select for export" aria-label="Select ${esc(d.host)} for export"></button>` +
    `<div class="l1"><span class="host">${esc(d.host)}</span>${langs}<span class="feeds">${count(d)}</span></div><div class="l2">${esc(sub)}</div>` +
    `<span class="check" title="Selected for export"></span>`;
}

function renderList(reset) {
  if (reset) {
    rendered.forEach((el) => el.remove());
    rendered = new Map();
    list.scrollTop = 0;
  }
  spacer.style.height = rows.length * ROW_HEIGHT + 'px';
  $('loading').style.display = rows.length ? 'none' : '';
  if (!rows.length) $('loading').textContent = 'Nothing matches the filters.';

  const first = Math.max(0, Math.floor(list.scrollTop / ROW_HEIGHT) - 10);
  const last = Math.min(rows.length, Math.ceil((list.scrollTop + list.clientHeight) / ROW_HEIGHT) + 10);
  for (const [i, el] of rendered) if (i < first || i >= last) { el.remove(); rendered.delete(i); }
  for (let i = first; i < last; i++) {
    let el = rendered.get(i);
    if (!el) {
      el = document.createElement('div');
      el.className = 'row';
      el.style.top = i * ROW_HEIGHT + 'px';
      el.dataset.i = i;
      el.innerHTML = rowHTML(rows[i]);
      list.appendChild(el);
      rendered.set(i, el);
    }
    el.classList.toggle('on', rows[i] === state.selected);
    el.classList.toggle('picked', picked().has(rows[i]));
  }
}

list.addEventListener('scroll', () => renderList(false), { passive: true });
window.addEventListener('resize', () => DB && renderList(false));
list.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (!row) return;
  const d = rows[+row.dataset.i];
  if (e.target.closest('.pick, .check')) togglePicked(d);
  else openPreview(d);
});

function togglePicked(d) {
  const set = picked();
  set.has(d) ? set.delete(d) : set.add(d);
  renderList(false);
  renderExport();
}

// ---------------------------------------------------------------- toolbar & menus

function renderPills() {
  const set = { categories: state.categories, length: state.lengths, languages: state.languages };
  document.querySelectorAll('[data-menu]').forEach((b) => {
    const n = set[b.dataset.menu].size;
    b.classList.toggle('active', n > 0);
    const base = { categories: 'Categories', length: 'Length', languages: 'Language' }[b.dataset.menu];
    b.innerHTML = esc(base) + (n ? ` <span class="count">${n}</span>` : '');
  });
}

const menu = $('menu');
let menuFor = null;

function menuOptions(kind) {
  if (kind === 'categories') {
    return DB.categories.map((name, i) => ({ value: i, label: name })).sort((a, b) => a.label.localeCompare(b.label));
  }
  if (kind === 'length') return LENGTHS.map((l) => ({ value: l.id, label: l.label }));
  const n = new Array(DB.languages.length).fill(0);
  for (const d of DB.domains) if (count(d)) for (const l of d.langs) n[l]++;
  return DB.languages.map((code, i) => ({ value: i, label: langName(code), hint: code, n: n[i] }))
    .filter((o) => o.n).sort((a, b) => b.n - a.n);
}

function openMenu(btn) {
  const kind = btn.dataset.menu;
  if (menuFor === btn) return closeMenu();
  menuFor = btn;
  const set = { categories: state.categories, length: state.lengths, languages: state.languages }[kind];
  const opts = menuOptions(kind);
  const draw = (q = '') => {
    const items = opts.filter((o) => !q || o.label.toLowerCase().includes(q) || String(o.hint || '').startsWith(q));
    return items.map((o) => `<label><input type="checkbox" value="${o.value}"${set.has(o.value) ? ' checked' : ''}> ${esc(o.label)}${o.n ? `<small>${o.n.toLocaleString('en')}</small>` : ''}</label>`).join('');
  };
  menu.innerHTML = (kind === 'languages' ? '<input type="search" placeholder="Search languages…">' : '') +
    `<div class="opts">${draw()}</div><button class="reset">Reset</button>`;
  menu.hidden = false;
  const r = btn.getBoundingClientRect();
  menu.style.top = r.bottom + 6 + 'px';
  menu.style.left = Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8)) + 'px';

  const search = menu.querySelector('input[type=search]');
  if (search) {
    search.focus();
    search.oninput = () => { menu.querySelector('.opts').innerHTML = draw(search.value.trim().toLowerCase()); };
  }
  menu.onchange = (e) => {
    if (e.target.type !== 'checkbox') return;
    const v = kind === 'length' ? e.target.value : +e.target.value;
    e.target.checked ? set.add(v) : set.delete(v);
    applyFilters();
  };
  menu.querySelector('.reset').onclick = () => {
    set.clear();
    menu.querySelectorAll('input[type=checkbox]').forEach((c) => (c.checked = false));
    applyFilters();
  };
}

function closeMenu() {
  menu.hidden = true;
  menuFor = null;
}

document.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openMenu(b); }));
document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });

document.querySelectorAll('.segmented button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.segmented button').forEach((x) => x.classList.toggle('on', x === b));
  state.mode = b.dataset.mode;
  state.categories.clear();
  closeMenu();
  applyFilters();
}));

$('sort').addEventListener('change', (e) => { state.sort = e.target.value; applyFilters(); });
$('countrySelect').addEventListener('change', (e) => { state.country = +e.target.value; applyFilters(); });
$('countries').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  state.country = +li.dataset.i;
  applyFilters();
});

let debounce;
$('domainFilter').addEventListener('input', (e) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { state.query = e.target.value.trim().toLowerCase(); applyFilters(); }, 120);
});
$('countryFilter').addEventListener('input', (e) => {
  state.countryQuery = e.target.value.trim().toLowerCase();
  renderCountries(countryCounts, countryCounts.reduce((a, b) => a + b, 0));
});

// ---------------------------------------------------------------- OPML export

// With a selection the button exports exactly the picked domains (all their feeds, whatever the
// filters); without one it exports everything shown, narrowed to the chosen categories.
function renderExport() {
  const n = picked().size;
  const btn = $('exportBtn');
  btn.textContent = n ? `Export ${n.toLocaleString('en')} Selected` : `Export All (${rows.length.toLocaleString('en')})`;
  btn.title = n ? 'Download the selected sources as an OPML file' : 'Download the shown sources as an OPML file';
  btn.classList.toggle('primary', n > 0);
  btn.disabled = !n && !rows.length;
  $('clearPicked').hidden = !n;
}

$('clearPicked').addEventListener('click', () => {
  picked().clear();
  renderList(false);
  renderExport();
});

$('exportBtn').addEventListener('click', () => {
  const xa = (s) => esc(s);
  const set = picked();
  const domains = set.size ? [...set].sort(sorters[state.sort]) : rows;
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<opml version="2.0">',
    `<head><title>InfoBubble catalog export</title><dateCreated>${new Date().toUTCString()}</dateCreated></head>`, '<body>'];
  for (const d of domains) {
    const feeds = feedsOf(d).filter((f) => set.size || !state.categories.size || state.categories.has(f.cat));
    if (!feeds.length) continue;
    out.push(`<outline text="${xa(d.host)}" title="${xa(d.host)}">`);
    for (const f of feeds) {
      out.push(`  <outline type="rss" text="${xa(d.host + ' — ' + DB.categories[f.cat])}" xmlUrl="${xa(f.url)}" htmlUrl="https://${xa(d.host)}" category="${xa(DB.categories[f.cat])}"/>`);
    }
    out.push('</outline>');
  }
  out.push('</body>', '</opml>');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/x-opml' }));
  const where = set.size ? 'selected' : state.country >= 0 ? DB.countries[state.country].replace(/\W+/g, '-') : 'all';
  a.download = `infobubble-${state.mode}-${where}.opml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ---------------------------------------------------------------- feed fetching & parsing

const feedCache = new Map();

function withTimeout(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  return fetch(url, { signal: ctl.signal, redirect: 'follow' }).finally(() => clearTimeout(t));
}

function decode(buf, contentType) {
  const head = new TextDecoder('ascii').decode(buf.slice(0, 300));
  const enc = (head.match(/encoding=["']([\w-]+)["']/i) || contentType.match(/charset=([\w-]+)/i) || [])[1];
  try { return new TextDecoder(enc || 'utf-8').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}

async function fetchXML(url) {
  const res = await withTimeout(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = decode(await res.arrayBuffer(), res.headers.get('content-type') || '');
  if (!/<(rss|feed|rdf:RDF|channel)[\s>]/i.test(text)) throw new Error('Not a feed');
  return text;
}

async function fetchRss2json(url) {
  const res = await withTimeout(RSS2JSON + encodeURIComponent(url));
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(json.message || 'rss2json error');
  return json.items.map((it) => {
    const date = it.pubDate ? new Date(it.pubDate.replace(' ', 'T') + 'Z') : null;
    const media = it.enclosure?.link || '';
    const mediaType = it.enclosure?.type || '';
    return {
      title: htmlToText(it.title) || '(untitled)',
      link: it.link || '',
      html: it.content || it.description || '',
      snippet: htmlToText(it.description || it.content).slice(0, 400),
      date: date && !isNaN(date) ? date : null,
      media: /^audio|^video/.test(mediaType) ? media : '',
      mediaType,
      feed: url,
    };
  });
}

async function fetchFeed(url) {
  const attempts = [];
  if (OWN_PROXY) attempts.push(() => fetchXML(OWN_PROXY + encodeURIComponent(url)).then((t) => parseFeed(t, url)));
  // Direct request only makes sense over https (http would be blocked as mixed content).
  if (location.protocol !== 'https:' || url.startsWith('https:')) attempts.push(() => fetchXML(url).then((t) => parseFeed(t, url)));
  attempts.push(() => fetchRss2json(url));
  for (const p of RAW_PROXIES) attempts.push(() => fetchXML(p(url)).then((t) => parseFeed(t, url)));
  let lastErr;
  for (const attempt of attempts) {
    try { return await attempt(); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Failed');
}

const kid = (el, ...names) => {
  for (const n of names) for (const c of el.children) if (c.localName === n || c.nodeName === n) return c;
  return null;
};
const txt = (el, ...names) => (kid(el, ...names)?.textContent || '').trim();

function parseXML(text) {
  const p = new DOMParser();
  let doc = p.parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    const fixed = text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&(?!(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);)/gi, '&amp;');
    doc = p.parseFromString(fixed, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XML');
  }
  return doc;
}

function parseFeed(text, feedUrl) {
  const doc = parseXML(text);
  const entries = [...doc.getElementsByTagName('item'), ...doc.getElementsByTagNameNS('*', 'entry')];
  return entries.map((el) => {
    let link = txt(el, 'link');
    if (!link) {
      const links = [...el.children].filter((c) => c.localName === 'link');
      const l = links.find((c) => !c.getAttribute('rel') || c.getAttribute('rel') === 'alternate') || links[0];
      link = l?.getAttribute('href') || '';
    }
    if (!link) { const g = txt(el, 'guid'); if (/^https?:/.test(g)) link = g; }
    try { link = new URL(link, feedUrl).href; } catch { /* keep as is */ }

    const enc = kid(el, 'enclosure');
    const atomEnc = [...el.children].find((c) => c.localName === 'link' && c.getAttribute('rel') === 'enclosure');
    const media = enc?.getAttribute('url') || atomEnc?.getAttribute('href') || '';
    const mediaType = enc?.getAttribute('type') || atomEnc?.getAttribute('type') || '';

    const content = txt(el, 'encoded') || (kid(el, 'content')?.textContent || '').trim();
    const summary = txt(el, 'description', 'summary') || txt(el, 'subtitle');
    const dateStr = txt(el, 'pubDate', 'published', 'updated', 'date', 'issued');
    const date = dateStr ? new Date(dateStr) : null;
    return {
      title: htmlToText(txt(el, 'title')) || '(untitled)',
      link,
      html: content || summary,
      snippet: htmlToText(summary || content).slice(0, 400),
      date: date && !isNaN(date) ? date : null,
      media: /^audio|^video/.test(mediaType) || /\.(mp3|m4a|aac|ogg|mp4)(\?|$)/i.test(media) ? media : '',
      mediaType,
      feed: feedUrl,
    };
  });
}

function htmlToText(s) {
  if (!s) return '';
  const d = new DOMParser().parseFromString(s, 'text/html');
  return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
}

const ALLOWED = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'img', 'figure',
  'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'span', 'div', 'small', 'sub', 'sup', 'hr', 'table',
  'thead', 'tbody', 'tr', 'td', 'th', 'picture']);
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'noscript', 'link', 'meta', 'svg', 'math', 'template']);

function sanitize(html, base) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node) => {
    for (const el of [...node.children]) {
      const tag = el.localName;
      if (DROP.has(tag)) { el.remove(); continue; }
      walk(el);
      if (!ALLOWED.has(tag)) { el.replaceWith(...el.childNodes); continue; }
      const href = el.getAttribute('href');
      const src = el.getAttribute('src');
      for (const a of [...el.attributes]) el.removeAttribute(a.name);
      const safe = (u) => { try { const x = new URL(u, base); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
      if (tag === 'a' && href && safe(href)) { el.href = safe(href); el.target = '_blank'; el.rel = 'noopener noreferrer'; }
      if (tag === 'img') {
        if (src && safe(src)) { el.src = safe(src); el.loading = 'lazy'; el.referrerPolicy = 'no-referrer'; } else el.remove();
      }
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

// ---------------------------------------------------------------- preview panel

const preview = $('preview');
const articlePanel = $('article');
let previewItems = [];
let previewToken = 0;
let currentItem = -1;

const fmtShort = (d) => d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' at') : '';
const fmtLong = (d) => d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' at') : '';
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };

function openPreview(d, force = false) {
  state.selected = d;
  renderList(false);
  closeArticle();
  preview.hidden = false;
  $('previewTitle').textContent = 'Preview: ' + d.host;
  const feeds = feedsOf(d).slice(0, MAX_PREVIEW_FEEDS);
  const total = feedsOf(d).length;
  $('feedsToggle').textContent = `Feeds: ${total} ▾`;
  $('feedList').innerHTML = feedsOf(d).map((f, i) =>
    `<li><span class="st" data-f="${i}">•</span><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a><span class="cat">${esc(DB.categories[f.cat])}</span></li>`).join('');
  $('items').innerHTML = '';
  previewItems = [];
  const token = ++previewToken;
  let done = 0, failed = 0;
  const status = () => {
    const loading = done < feeds.length;
    $('reload').classList.toggle('spin', loading);
    $('previewStatus').textContent = `News: ${previewItems.length} · Feeds: ${done - failed}/${feeds.length} loaded` +
      (failed ? ` · ${failed} failed` : '') + (total > feeds.length ? ` (first ${feeds.length} of ${total})` : '') +
      (loading ? ' · loading…' : '');
    if (!loading && !previewItems.length) {
      $('items').innerHTML = `<div class="empty">Couldn't load any news.<br>The feed may be offline or not reachable through the public CORS services.</div>`;
    }
  };
  status();

  feeds.forEach((f, i) => {
    const key = f.url;
    if (force) feedCache.delete(key);
    if (!feedCache.has(key)) feedCache.set(key, fetchFeed(f.url));
    feedCache.get(key).then((items) => {
      if (token !== previewToken) return;
      setFeedStatus(i, true);
      previewItems.push(...items);
      previewItems.sort((a, b) => (b.date || 0) - (a.date || 0));
      previewItems = dedupe(previewItems).slice(0, 100);
      renderItems();
    }, (err) => {
      feedCache.delete(key);
      if (token !== previewToken) return;
      failed++;
      setFeedStatus(i, false, err.message);
    }).finally(() => {
      if (token !== previewToken) return;
      done++;
      status();
    });
  });
}

function setFeedStatus(i, ok, msg) {
  const el = $('feedList').querySelector(`[data-f="${i}"]`);
  if (!el) return;
  el.className = 'st ' + (ok ? 'ok' : 'err');
  el.textContent = ok ? '✓' : '✕';
  if (msg) el.title = msg;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((it) => { const k = it.link || it.title; if (seen.has(k)) return false; seen.add(k); return true; });
}

function renderItems() {
  $('items').innerHTML = previewItems.map((it, i) => `
    <div class="item${i === currentItem ? ' on' : ''}" data-i="${i}">
      <div class="t">${esc(it.title)}</div>
      ${it.snippet ? `<div class="d">${esc(it.snippet)}</div>` : ''}
      <div class="m">${esc(hostOf(it.link) || hostOf(it.feed))}${it.date ? ' · ' + esc(fmtShort(it.date)) : ''}</div>
    </div>`).join('');
}

$('items').addEventListener('click', (e) => {
  const el = e.target.closest('.item');
  if (el) openArticle(+el.dataset.i);
});
$('feedsToggle').addEventListener('click', () => { $('feedList').hidden = !$('feedList').hidden; });
$('reload').addEventListener('click', () => state.selected && openPreview(state.selected, true));
preview.querySelector('.close').addEventListener('click', closePreview);

function closePreview() {
  preview.hidden = true;
  previewToken++;
  closeArticle();
  state.selected = null;
  renderList(false);
}

// ---------------------------------------------------------------- article panel

function openArticle(i) {
  const it = previewItems[i];
  if (!it) return;
  currentItem = i;
  document.querySelectorAll('.item').forEach((el) => el.classList.toggle('on', +el.dataset.i === i));
  document.querySelector(`.item[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' });
  articlePanel.hidden = false;
  const host = hostOf(it.link);
  $('articleMeta').innerHTML = esc(fmtLong(it.date)) + (host ? ` · <a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(host)} ↗</a>` : '');
  $('articleTitle').textContent = it.title;
  let body = it.html ? sanitize(/<[a-z][\s\S]*>/i.test(it.html) ? it.html : esc(it.html).replace(/\n/g, '<br>'), it.link || it.feed) : '';
  if (it.media) {
    const tag = /^video/.test(it.mediaType) ? 'video' : 'audio';
    body = `<${tag} controls preload="none" src="${esc(it.media)}"></${tag}>` + body;
  }
  $('articleBody').innerHTML = body || '<p class="empty">No text in the feed — open the original.</p>';
  $('openOriginal').href = it.link || it.feed;
  $('openOriginal').hidden = !(it.link || it.feed);
  $('prevItem').disabled = i <= 0;
  $('nextItem').disabled = i >= previewItems.length - 1;
  articlePanel.querySelector('.article-scroll').scrollTop = 0;
}

function closeArticle() {
  articlePanel.hidden = true;
  articlePanel.querySelectorAll('audio, video').forEach((m) => m.pause());
  currentItem = -1;
  document.querySelectorAll('.item.on').forEach((el) => el.classList.remove('on'));
}

$('prevItem').addEventListener('click', () => openArticle(currentItem - 1));
$('nextItem').addEventListener('click', () => openArticle(currentItem + 1));
articlePanel.querySelector('.close').addEventListener('click', closeArticle);

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select')) return;
  if (e.key === 'Escape') {
    if (!menu.hidden) closeMenu();
    else if (!articlePanel.hidden) closeArticle();
    else if (!preview.hidden) closePreview();
  } else if (!articlePanel.hidden && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const n = currentItem + (e.key === 'ArrowLeft' ? -1 : 1);
    if (n >= 0 && n < previewItems.length) openArticle(n);
  }
});

// ---------------------------------------------------------------- boot

const dataScript = document.createElement('script');
dataScript.src = 'data/catalog.js';
dataScript.onload = () => {
  DB = prepare(window.CATALOG_DATA);
  delete window.CATALOG_DATA;
  applyFilters();
};
dataScript.onerror = () => { $('loading').textContent = 'Failed to load catalog data (data/catalog.js).'; };
document.head.appendChild(dataScript);
