'use strict';

/* ══════════════════════════════════════════════════════════════
   DIAL — search Apple's public podcast directory and play the
   audio the publisher already hosts. No backend, no key.

   search : itunes.apple.com/search?media=podcast&entity=podcast
   eps    : itunes.apple.com/lookup?id=…&entity=podcastEpisode
   audio  : <audio src=episodeUrl>   (206, Accept-Ranges: bytes)
   ══════════════════════════════════════════════════════════════ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const fmt = total => {
  const s = Math.max(0, Math.floor(total || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};

const fmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ── persistence ─────────────────────────────────────────── */
const store = {
  get(k, fallback) {
    try { const v = localStorage.getItem('dial.' + k); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem('dial.' + k, JSON.stringify(v)); } catch { /* private mode / quota */ }
  }
};

/* ── directory API ───────────────────────────────────────── */
const TIMEOUT = 18000;

/* Opened from disk the page has an opaque origin and Chromium blocks
   cross-origin fetch; the directory also speaks JSONP, so use that. */
const NEEDS_JSONP = location.protocol === 'file:';

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = '__dial_cb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('The directory did not answer in time.')), TIMEOUT);

    function finish(err, data) {
      clearTimeout(timer);
      try { delete window[cb]; } catch { window[cb] = undefined; }
      script.remove();
      err ? reject(err) : resolve(data);
    }

    window[cb] = data => finish(null, data);
    script.onerror = () => finish(new Error('Could not reach the podcast directory.'));
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    document.head.appendChild(script);
  });
}

function getJSON(url) {
  if (NEEDS_JSONP) return jsonp(url);

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  return fetch(url, { signal: ctl.signal })
    .then(r => {
      if (!r.ok) throw new Error('Directory replied ' + r.status);
      return r.json();
    })
    .finally(() => clearTimeout(t));
}

const API = {
  search(term, limit = 24) {
    return getJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
      `&media=podcast&entity=podcast&limit=${limit}&country=us`)
      .then(d => (d.results || []).filter(r => r.collectionId && r.kind === 'podcast').map(toShow));
  },
  episodes(id, limit = 200) {
    return getJSON(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}` +
      `&entity=podcastEpisode&limit=${limit}&country=us`)
      .then(d => d.results || []);
  }
};

function toShow(r) {
  return {
    id: r.collectionId,
    name: r.collectionName || 'Untitled',
    artist: r.artistName || '',
    art: (r.artworkUrl600 || r.artworkUrl100 || '').replace(/\/\d+x\d+bb\./, '/600x600bb.'),
    genre: r.primaryGenreName || '',
    count: r.trackCount || 0,
    feed: r.feedUrl || ''
  };
}

function toEpisode(r, show) {
  return {
    id: r.trackId,
    title: r.trackName || 'Untitled episode',
    url: r.episodeUrl,
    dur: Math.round((r.trackTimeMillis || 0) / 1000),
    date: r.releaseDate || '',
    art: show ? show.art : (r.artworkUrl600 || r.artworkUrl160 || ''),
    showId: show ? show.id : null,
    showName: show ? show.name : ''
  };
}

/* ── state ───────────────────────────────────────────────── */
const state = {
  saved: store.get('saved', []),
  log: store.get('log', []),
  rate: store.get('rate', 1),
  now: null,
  show: null,
  episodes: [],
  railCache: new Map(),
  heroShows: [],
  heroIndex: 0
};

const CHIPS = ['daily news', 'science', 'true crime', 'business', 'comedy', 'history', 'english learning', 'slow english'];

const RAILS = {
  onair: { q: 'daily news', limit: 12 },
  new: { q: 'science technology', limit: 8 },
  recommended: { q: 'storytelling', limit: 8 }
};

/* ══════════════════════════════════════════════════════════
   MARKUP
   ══════════════════════════════════════════════════════════ */
function cardHTML(s, cls = '') {
  return `<a class="card${cls ? ' ' + cls : ''}" href="#/s/${encodeURIComponent(s.id)}">
    <img class="card-img" src="${esc(s.art)}" alt="" loading="lazy" decoding="async">
    <h3 class="card-title">${esc(s.name)}</h3>
    <p class="card-sub">${esc(s.artist)}</p>
  </a>`;
}

function noteCardHTML(show) {
  return `<a class="note-card" href="#/s/${encodeURIComponent(show.showId || show.id)}">
    <img src="${esc(show.art)}" alt="" loading="lazy">
    <span class="note-card-body">
      <h3>${esc(show.title || show.name)}</h3>
      <p>${esc(show.showName || '')}${show.pos ? ' · ' + fmt(show.pos) : ''}</p>
    </span>
  </a>`;
}

const scanning = (text = 'Scanning') => `<p class="scanning">${esc(text)}</p>`;

const fault = (err, label = 'Try again') => `<div class="fault">
  <strong>Signal lost</strong>
  ${esc(err && err.message ? err.message : 'The podcast directory did not answer.')}
  <button type="button" data-retry>${esc(label)}</button>
</div>`;

function showView(id) {
  $$('.view').forEach(v => { v.hidden = v.id !== id; });
  document.body.classList.toggle('is-home', id === 'view-home');
  $('.site-header').inert = false;
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ══════════════════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════════════════ */
let featuredJob = null;
let libraryJob = null;
let libraryRequested = false;

const CONTENT = () => window.DIAL_CONTENT || { news: [], entertainment: [], held: [] };

async function renderHome() {
  showView('view-home');
  if (!featuredJob) {
    featuredJob = (async () => {
      try {
        const shows = CONTENT().news.map(e => ({ id: e.showId, name: e.name, artist: e.publisher, art: e.art }));
        if (!shows.length) throw new Error('No verified entries are loaded.');
        state.heroShows = shows.slice(0, 4);
        buildHero();
      } catch (error) {
        $('#heroTrack').innerHTML = fault(error);
        featuredJob = null;
      }
    })();
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) ensureHomeLibrary();
  return featuredJob;
}

/* The library is built once, after the lettering has left the screen. */
function ensureHomeLibrary() {
  if (libraryJob) return libraryJob;
  libraryRequested = true;
  renderLibrary();
  libraryJob = Promise.resolve();
  return libraryJob;
}

function renderLibrary() {
  const c = CONTENT();
  const news = c.news || [];
  const ent = c.entertainment || [];
  const classic = c.classic;
  const stamp = c.checked || fmtCardDate(new Date().toISOString().slice(0, 10));

  const meta = $('#newsMeta');
  if (meta) meta.textContent = `${news.length} sources · checked ${stamp}`;

  const grid = $('#newsGrid');
  if (grid && !grid.childElementCount) {
    grid.innerHTML = news.length ? news.map((e, i) => winCardHTML(e, i)).join('')
      : '<p class="empty">Nothing verified for this section yet.</p>';
  }

  const entMeta = $('#entMeta');
  if (entMeta) entMeta.textContent = `${ent.length} shows · checked ${stamp}`;

  const split = $('#entSplit');
  if (split && !split.childElementCount && ent.length) {
    split.innerHTML = [ent.slice(0, 2), ent.slice(2, 4)]
      .map((pair, i) => `<div class="pane pane--${i ? 'right' : 'left'}">${pair.map(paneSlideHTML).join('')}</div>`)
      .join('');
    const total = $('#cineTotal');
    if (total) total.textContent = String(Math.ceil(ent.length / 2)).padStart(2, '0');
  }

  const classicWrap = $('#classicWrap');
  if (classicWrap && !classicWrap.childElementCount && classic) classicWrap.innerHTML = classicHTML(classic);

  mountLibrary();
}

function winCardHTML(e, i = 0) {
  return `<a class="win reveal" style="--i:${i % 4}" href="#/s/${encodeURIComponent(e.showId)}">
    <span class="media"><img class="cover-img" data-cover src="${esc(e.art)}" alt="" decoding="async"></span>
    <span class="ep">${esc(e.latest.title)}</span>
    <span class="src">${esc(e.name)} · ${esc(e.publisher)}</span>
    <span class="row"><span class="src">${esc(fmtCardDate(e.latest.published))}</span><span class="dur">${esc(fmt(e.latest.duration))}</span></span>
  </a>`;
}

function paneSlideHTML(e) {
  return `<div class="shot">
    <img data-cover src="${esc(e.art)}" alt="" decoding="async">
    <div class="shot-copy">
      <p class="shot-kicker">${esc(e.name)} · ${esc(e.publisher)}</p>
      <p class="shot-title">${esc(e.latest.title)}</p>
      <p class="shot-meta">${esc(fmtCardDate(e.latest.published))} · ${esc(fmt(e.latest.duration))}</p>
      <button class="play" type="button" data-play-show="${encodeURIComponent(e.showId)}" aria-label="Play ${esc(e.latest.title)}">
        <svg viewBox="0 0 11 12" aria-hidden="true"><path d="M0 0l11 6-11 6z"/></svg>
      </button>
    </div>
  </div>`;
}

function classicHTML(b) {
  const r = b.recording || {};
  return `<figure class="classic-art reveal">
      <span class="media"><img class="cover-img" data-cover src="${esc(b.art)}" alt="${esc(b.title)} cover"></span>
      <figcaption><span>${esc(b.publisher)} edition</span><span>${esc(String(r.sections || ''))} sections</span></figcaption>
    </figure>
    <div class="classic-body">
      <h3 class="classic-title">${esc(b.title)}</h3>
      <p class="byline">${esc(b.author)}, ${esc(String(b.year))} <span>· read for ${esc(b.publisher)}</span></p>
      <dl class="ledger">
        <div><dt>Recording</dt><dd>${esc(r.range || '')}<small>${esc(String(r.sections || ''))} files, in order</small></dd></div>
        <div><dt>Running time</dt><dd>${esc(fmt(r.total || 0))}</dd></div>
        <div><dt>Audio</dt><dd>${esc(r.host || '')}<small>${esc(r.format || '')}</small></dd></div>
        <div><dt>Full text</dt><dd class="flag">${esc(b.text.label)}<small>${esc(b.text.note)}</small></dd></div>
      </dl>
      <ol class="chapters">
        ${(b.chapters || []).map(ch => `<li><a href="#/s/${encodeURIComponent(b.showId)}">
          <span class="idx">${esc(ch.index)}</span><span class="name">${esc(ch.name)}</span><span class="dur">${esc(fmt(ch.duration))}</span></a></li>`).join('')}
      </ol>
      <div class="lib-actions">
        <button class="btn-blue" type="button" data-play-show="${encodeURIComponent(b.showId)}">Play chapter 1</button>
        <a class="btn-quiet" href="${esc(b.text.url)}" target="_blank" rel="noopener">Full text</a>
      </div>
    </div>`;
}

/* ── library interactions: decode → fade, reveal, pins, lock ── */
function mountLibrary() {
  if (mountLibrary.booted) { mountLibrary.refresh?.(); return; }
  mountLibrary.booted = true;

  const covers = $$('.home-library img[data-cover]');
  covers.forEach((img, i) => {
    const media = img.closest('.media');
    const markReady = () => {
      img.classList.add('is-ready');
      if (media) media.classList.add('is-loaded');
      const card = img.closest('.reveal');
      if (card) card.classList.add('is-in');
    };
    const run = () => {
      if (img.complete && img.naturalWidth) {
        (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(markReady);
      } else {
        img.addEventListener('load', () => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(markReady), { once: true });
        img.addEventListener('error', () => { if (media) media.classList.add('is-loaded'); }, { once: true });
      }
    };
    setTimeout(run, Math.min(8, i) * 45);
  });

  const revealables = $$('.home-library .reveal:not(.is-in)');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealables.forEach(el => io.observe(el));
  } else {
    revealables.forEach(el => el.classList.add('is-in'));
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const classicBand = $('#sec-classic');
  const cineBand = $('#sec-ent');
  const cineStage = $('#cineStage');
  const classicCover = $('#classicWrap .classic-art img');
  const panes = $$('#entSplit .pane');
  const cineNow = $('#cineNow');

  let cineTarget = 0, cineShown = null, cineRaf = null, cineP = 0;

  function renderCine(blend, p, counter) {
    const ops = [1 - blend, blend];
    panes.forEach(pane => {
      $$('.shot', pane).forEach((shot, i) => {
        const op = ops[Math.min(i, 1)];
        shot.style.opacity = op.toFixed(3);
        const img = shot.querySelector('img');
        if (img) img.style.transform = `translate3d(0, ${((0.5 - p) * 2.2).toFixed(2)}%, 0) scale(${(1.04 + blend * 0.025 + i * 0.004).toFixed(3)})`;
        const copy = shot.querySelector('.shot-copy');
        const copyOp = Math.min(1, Math.max(0, (op - 0.1) / 0.6));
        if (copy) { copy.style.opacity = copyOp.toFixed(3); copy.style.transform = `translate3d(0, ${((1 - copyOp) * 16).toFixed(1)}px, 0)`; }
      });
    });
    if (cineNow) cineNow.textContent = counter;
  }

  function stepCine() {
    cineRaf = null;
    const diff = cineTarget - cineShown;
    if (Math.abs(diff) < 0.002) {
      cineShown = cineTarget;
      renderCine(cineShown, cineP, cineShown > 0.5 ? '02' : '01');
      return;
    }
    cineShown += diff * 0.2;
    renderCine(cineShown, cineP, cineShown > 0.5 ? '02' : '01');
    cineRaf = requestAnimationFrame(stepCine);
  }

  function pins() {
    if (reduce.matches) {
      if (classicCover) classicCover.style.transform = 'none';
      if (cineStage) cineStage.style.setProperty('--p', '0');
      panes.forEach(pane => {
        $$('.shot', pane).forEach((shot, i) => {
          shot.style.opacity = i ? '0' : '1';
          const img = shot.querySelector('img');
          if (img) img.style.transform = 'none';
          const copy = shot.querySelector('.shot-copy');
          if (copy) { copy.style.opacity = '1'; copy.style.transform = 'none'; }
        });
      });
      return;
    }

    if (classicBand && classicCover) {
      const travel = Math.max(1, classicBand.offsetHeight - innerHeight);
      const p = Math.min(1, Math.max(0, -classicBand.getBoundingClientRect().top / travel));
      classicCover.style.transform = `scale(${(1 + p * 0.045).toFixed(4)})`;
    }

    if (cineBand && cineStage) {
      const travel = Math.max(1, cineBand.offsetHeight - innerHeight);
      cineP = Math.min(1, Math.max(0, -cineBand.getBoundingClientRect().top / travel));
      cineStage.style.setProperty('--p', cineP.toFixed(4));
      cineTarget = Math.min(1, Math.max(0, (cineP - 0.35) / 0.28));
      if (cineShown === null) {
        cineShown = cineTarget;
        renderCine(cineShown, cineP, cineTarget > 0.5 ? '02' : '01');
      } else if (cineRaf === null && Math.abs(cineTarget - cineShown) > 0.002) {
        cineRaf = requestAnimationFrame(stepCine);
      }
    }

  }
  mountLibrary.refresh = pins;

  let frame = null;
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(() => { frame = null; pins(); }); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  reduce.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  pins();
}

function fmtCardDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* Playing from the library: fetch the show's episodes, play the first in order. */
async function playFromShow(showId) {
  try {
    const eps = await API.episodes(showId);
    const list = (eps || [])
      .filter(e => e && e.episodeUrl)
      .sort((a, b) => new Date(a.releaseDate || 0) - new Date(b.releaseDate || 0));
    if (!list.length) throw new Error('That show returned no playable episodes.');
    const entry = (CONTENT().news || []).concat(CONTENT().entertainment || [])
      .find(e => String(e.showId) === String(showId));
    const classic = CONTENT().classic;
    const meta = entry || (classic && String(classic.showId) === String(showId)
      ? { name: classic.title, publisher: classic.publisher, art: classic.art } : null);
    startEpisode(toEpisode(list[0], meta ? { id: showId, name: meta.name, art: meta.art } : null));
  } catch (error) {
    notePlayback(error && error.message ? error.message : 'That episode could not be reached.');
    console.warn('playFromShow', error);
  }
}

/* ── hero carousel: sunken neighbours, one floating ──────── */
let heroTimer = 0;

function buildHero() {
  const track = $('#heroTrack');
  if (!track || !state.heroShows.length) return;

  track.innerHTML = state.heroShows.map(show => `
    <a class="hero-card" href="#/s/${encodeURIComponent(show.id)}">
      <img src="${esc(show.art)}" alt="" loading="eager" decoding="async">
      <h3>${esc(show.name)}</h3>
      <p>${esc(show.artist)}</p>
    </a>`).join('');

  layoutHero(0, true);
  startHeroAuto();
}

/* A tilted single focal card cross-fades, following the JFN reference. */
function layoutHero(index, instant) {
  const cards = $$('#heroTrack .hero-card');
  if (!cards.length) return;
  state.heroIndex = ((index % cards.length) + cards.length) % cards.length;
  cards.forEach((card, i) => {
    const selected = i === state.heroIndex;
    card.classList.toggle('is-active', selected);
    card.inert = !selected;
    card.setAttribute('aria-hidden', selected ? 'false' : 'true');
  });
}

function stepHero(delta) {
  layoutHero(state.heroIndex + delta, false);
  startHeroAuto();
}

function startHeroAuto() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    if (document.hidden || $('.hero-inner').inert || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    layoutHero(state.heroIndex + 1, false);
  }, 5000);
}

/* One scroll clock: immersive landscape, montage lettering, then library. */
function mountScene() {
  const journey = $('.hero'), viewport = $('.hero-visual');
  const scene = $('.hero-scene'), group = $('.scene-group'), near = $('.scene-near');
  const camera = $('.scene-camera');
  if (!journey || !viewport || !scene || !group || !near) return;
  const copy = $('.hero-inner'), bridge = $('.journey-bridge');
  const light = $('.scene-light'), header = $('.site-header');
  const library = $('#homeLibrary'), shadow = $('.snow-shadows'), fill = $('.snow-fill');
  const sheen = $$('.snow-sheen');
  const layers = $$('.scene-layer', group).map(el => ({ el, depth:Number(el.dataset.depth)||0 }));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  journey.style.setProperty('--journey-travel',`${DialSceneMotion.travelVh}svh`);
  let frame = null, active = false, visible = false, pointer = null;
  // 文库进度与滚轮解耦：滚动只给目标值，真正落位按时间缓动
  let libTarget = 0, libShown = 0, libRaf = null;

  function renderLibraryAt(r, snap) {
    library.style.setProperty('--lib-in', r.toFixed(3));
    library.style.opacity = Math.min(1, r * 1.6).toFixed(3);
    library.style.visibility = r > 0 ? 'visible' : 'hidden';
    library.style.transform = `translate3d(0,${((1 - r) * 62).toFixed(2)}svh,0)`;
    library.inert = r <= .05;
    if (r > .01) {
      const pending = library.querySelectorAll('.reveal:not(.is-in)');
      pending.forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.top < innerHeight * 1.15) el.classList.add('is-in');
      });
    }
    if (snap) { /* 低动态：直接到位，不做补间 */ }
  }

  // 约 340ms 收敛，与滚轮速度、DPI 无关
  function stepLibrary() {
    libRaf = null;
    const diff = libTarget - libShown;
    if (Math.abs(diff) < 0.0008) {
      libShown = libTarget;
      renderLibraryAt(libShown, true);
      return;
    }
    libShown += diff * 0.16;
    renderLibraryAt(libShown, false);
    libRaf = requestAnimationFrame(stepLibrary);
  }

  function paint() {
    frame = null;
    if (!active) return;
    if ($('#view-home').hidden) { header.inert=false; return; }
    const box = journey.getBoundingClientRect(), stage = viewport.getBoundingClientRect();
    const travel = Math.max(1, box.height - stage.height);
    const v = DialSceneMotion.sample(-box.top / travel);
    const x = pointer ? 3*v.parallax*Math.max(-1,Math.min(1,(pointer.x-stage.left)/stage.width*2-1)) : 0;
    const y = pointer ? 3*v.parallax*Math.max(-1,Math.min(1,(pointer.y-stage.top)/stage.height*2-1)) : 0;
    camera.style.transform = `perspective(1600px) rotateX(${-1.4*v.cameraTurn}deg) rotateY(${2.2*v.cameraTurn}deg) scale(${1+.035*v.cameraTurn})`;
    group.style.transform = `translate3d(${x}px,${y}px,0)`;
    for (const {el,depth} of layers) el.style.transform = `translate3d(0,${-v.parallax*480*depth}px,0)`;
    near.style.transform = `translate3d(${x}px,${y-v.parallax*6}px,0)`;
    shadow.style.opacity = v.snowShadow;
    fill.style.opacity = v.snowFill;
    for (const el of sheen) el.style.opacity = v.snowHighlight;
    light.style.transform = `translate3d(${v.sunX*stage.width-light.offsetWidth/2}px,${v.sunY*stage.height-light.offsetHeight/2}px,0)`;
    light.style.opacity = v.lightOpacity;
    scene.style.filter = `saturate(${v.saturation})`;
    scene.style.opacity = v.sceneOpacity;
    copy.style.opacity = v.copyOpacity;
    copy.style.transform = `translate3d(0,${v.copyY*stage.height}px,0)`;
    copy.inert = v.copyOpacity <= .08;
    copy.style.pointerEvents = copy.inert ? 'none' : '';
    bridge.style.opacity = v.textOpacity;
    bridge.style.transform = `translate3d(0,${(v.textY-.5)*stage.height}px,0)`;
    header.inert = scrollY >= header.offsetHeight;
    // 文库进度改由 updateLibrary() 独立驱动，见下
    library.setAttribute('aria-hidden', library.inert ? 'true' : 'false');
    if (v.loadAlbums) ensureHomeLibrary();
  }
  function schedule() { if (active && frame === null) frame = requestAnimationFrame(paint); }
  function move(e) { if (e.pointerType === 'mouse' && fine.matches) { pointer={x:e.clientX,y:e.clientY}; schedule(); } }
  function leave() { pointer=null; schedule(); }
  function reset() {
    for (const el of [scene,camera,group,near,light,shadow,fill,copy,bridge,library,...sheen,...layers.map(l=>l.el)]) {
      for (const key of ['transform','opacity','filter','visibility','pointer-events']) el.style.removeProperty(key);
    }
    copy.inert=false; header.inert=false;
    library.inert=false; library.setAttribute('aria-hidden','false');
    libTarget = libShown = 1;
    if (reduce.matches) ensureHomeLibrary();
  }
  const resize = new ResizeObserver(schedule);
  function sync() {
    const enabled=visible&&!$('#view-home').hidden&&!document.hidden&&!reduce.matches;
    if (enabled===active) return;
    active=enabled;
    if (active) {
      viewport.addEventListener('pointermove',move,{passive:true});
      viewport.addEventListener('pointerleave',leave);
      resize.observe(journey); resize.observe(viewport); paint();
    } else {
      viewport.removeEventListener('pointermove',move);
      viewport.removeEventListener('pointerleave',leave);
      resize.disconnect();
      if(frame!==null) cancelAnimationFrame(frame);
      frame=null; pointer=null;
      if (reduce.matches) reset();
    }
  }
  // 文库进度：只依赖滚动位置，不依赖 hero 是否仍在视口内
  function updateLibrary() {
    const box = journey.getBoundingClientRect();
    const travel = Math.max(1, box.height - viewport.clientHeight);
    const p = Math.min(1, Math.max(0, -box.top / travel));
    libTarget = DialSceneMotion.sample(p).albumReveal;
    if (reduce.matches) {
      libShown = libTarget;
      renderLibraryAt(libShown, true);
      return;
    }
    if (libRaf === null && libShown !== libTarget) libRaf = requestAnimationFrame(stepLibrary);
  }
  addEventListener('scroll', updateLibrary, { passive: true });

  const observer=new IntersectionObserver(entries=>{
    visible=entries[entries.length-1].isIntersecting; sync();
  });
  observer.observe(journey);
  window.addEventListener('scroll',()=>{
    if(active) { schedule(); return; }
    if(reduce.matches||document.hidden||!journey.getClientRects().length) return;
    const b=journey.getBoundingClientRect();
    if(b.bottom<=0||b.top>=innerHeight) return;
    visible=true; sync();
  },{passive:true});
  reduce.addEventListener('change',()=>{ reset(); sync(); });
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('resize',schedule,{passive:true});
  updateLibrary();
  if(reduce.matches) reset();
}

function relayoutHero() {
  const cards = $$('#heroTrack .hero-card');
  if (cards.length) layoutHero(state.heroIndex, true);
}

/* ── resume band ─────────────────────────────────────────── */
function renderResume() {
  const host = $('#grid-resume');
  if (!host) return;                      // library no longer carries a resume band
  const rows = state.log.slice(0, 3);

  if (!rows.length) {
    host.innerHTML = `<p class="empty">Nothing played yet. Search above, open a station, press play —
      and your place will show up here.</p>`;
    return;
  }
  host.innerHTML = rows.map(r => noteCardHTML({
    showId: r.showId,
    id: r.showId,
    art: r.art,
    title: r.title,
    showName: r.show,
    pos: r.pos
  })).join('');
}

/* ══════════════════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════════════════ */
let searchToken = 0;

async function renderSearch(term) {
  showView('view-search');
  const token = ++searchToken;

  $('#searchTitle').textContent = '“' + term + '”';
  $('#searchNote').textContent = '';

  const grid = $('#searchGrid');
  grid.innerHTML = scanning('Scanning the directory');
  $('#q').value = term;

  try {
    const shows = await API.search(term, 48);
    if (token !== searchToken) return;

    if (!shows.length) {
      grid.innerHTML = '';
      $('#searchNote').textContent =
        'No station on that frequency. Try a broader word — “news”, “science”, or a host’s name.';
      return;
    }
    $('#searchNote').textContent =
      `${shows.length} station${shows.length === 1 ? '' : 's'} — open one to see its episode log`;
    grid.innerHTML = shows.map(s => cardHTML(s)).join('');
  } catch (e) {
    if (token !== searchToken) return;
    grid.innerHTML = fault(e);
  }
}

/* ══════════════════════════════════════════════════════════
   SHOW
   ══════════════════════════════════════════════════════════ */
let showToken = 0;

async function renderShow(id) {
  showView('view-show');
  const token = ++showToken;

  $('#showName').textContent = 'Loading…';
  $('#showPub').textContent = '';
  $('#showGenre').textContent = '—';
  $('#showCount').textContent = '—';
  $('#showLatest').textContent = '—';
  $('#showDesc').textContent = '';
  $('#showArt').removeAttribute('src');
  $('#epCount').textContent = '';
  $('#eplist').innerHTML = scanning('Reading the feed');

  try {
    const results = await API.episodes(id, 200);
    if (token !== showToken) return;

    const head = results.find(r => r.wrapperType === 'track') || results[0];
    const show = toShow(head);
    const episodes = results
      .filter(r => r.kind === 'podcast-episode' && r.episodeUrl)
      .map(r => toEpisode(r, show));

    state.show = show;
    state.episodes = episodes;

    $('#showArt').src = show.art;
    $('#showArt').alt = show.name + ' artwork';
    $('#showName').textContent = show.name;
    $('#showPub').textContent = show.artist;
    $('#showGenre').textContent = show.genre || '—';
    $('#showCount').textContent = episodes.length || show.count || '—';
    $('#showLatest').textContent = episodes[0] ? fmtDate(episodes[0].date) : '—';
    $('#showDesc').textContent = head.description || head.longDescription || '';
    $('#epCount').textContent = episodes.length + ' EP';
    $('#showPlayLatest').disabled = !episodes.length;

    paintSave();
    renderEpisodeList();
  } catch (e) {
    if (token !== showToken) return;
    $('#showName').textContent = 'Could not load';
    $('#eplist').innerHTML = fault(e);
  }
}

function paintSave() {
  const btn = $('#showSave');
  if (!state.show) return;
  const on = isSaved(state.show.id);
  btn.dataset.on = on ? '1' : '0';
  btn.textContent = on ? 'Saved ✓' : 'Save';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function renderEpisodeList() {
  const n = state.episodes.length;
  $('#eplist').innerHTML = state.episodes.map((ep, i) => {
    const rec = logEntry(ep.id);
    const current = state.now && String(state.now.id) === String(ep.id);
    const pct = rec && ep.dur ? Math.min(99, Math.round(rec.pos / ep.dur * 100)) : 0;

    return `<li class="ep${current ? ' is-current' : ''}" data-ep="${esc(ep.id)}">
      <div class="ep-main">
        <p class="ep-title">${esc(ep.title)}</p>
        <p class="ep-sub"><span>${esc(fmtDate(ep.date))}</span><span>${esc(fmt(ep.dur))}</span><span>#${String(n - i).padStart(3, '0')}</span></p>
        ${pct ? `<p class="ep-progress">Resume at ${esc(fmt(rec.pos))} · ${pct}%</p>` : ''}
      </div>
      <button class="ep-play" type="button" data-play="${esc(ep.id)}" aria-label="${current && !audio.paused ? 'Pause' : 'Play'} ${esc(ep.title)}">
        ${current && !audio.paused
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5.5" width="3.6" height="13" fill="currentColor"/><rect x="13.4" y="5.5" width="3.6" height="13" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10.5-6.5z" fill="currentColor"/></svg>'}
      </button>
    </li>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   SAVED / LOG
   ══════════════════════════════════════════════════════════ */
const isSaved = id => state.saved.some(s => String(s.id) === String(id));

function toggleSaved(show) {
  state.saved = isSaved(show.id)
    ? state.saved.filter(s => String(s.id) !== String(show.id))
    : [show, ...state.saved];
  store.set('saved', state.saved);
}

function renderSaved() {
  showView('view-saved');
  $('#savedGrid').innerHTML = state.saved.map(s => cardHTML(s)).join('');
  $('#savedEmpty').hidden = state.saved.length > 0;
}

const logEntry = id => state.log.find(e => String(e.id) === String(id));

function logUpsert(ep, pos) {
  const at = Date.now();
  const existing = logEntry(ep.id);
  if (existing) {
    Object.assign(existing, { pos, at, url: ep.url, dur: ep.dur, title: ep.title, art: ep.art, show: ep.showName, showId: ep.showId });
  } else {
    state.log.unshift({
      id: ep.id, title: ep.title, show: ep.showName, showId: ep.showId,
      art: ep.art, url: ep.url, dur: ep.dur, pos, at
    });
  }
  state.log.sort((a, b) => b.at - a.at);
  state.log = state.log.slice(0, 120);
  store.set('log', state.log);
}

function renderLog() {
  showView('view-log');
  $('#logEmpty').hidden = state.log.length > 0;

  $('#loglist').innerHTML = state.log.map(e => `<li class="logrow">
    <img src="${esc(e.art)}" alt="" loading="lazy">
    <div>
      <p class="log-title">${esc(e.title)}</p>
      <p class="log-sub">${esc(e.show || '')} · ${esc(fmtDate(new Date(e.at).toISOString()))}</p>
    </div>
    <div class="log-actions">
      <span class="log-counter">${esc(fmt(e.pos))} / ${esc(fmt(e.dur))}</span>
      <button class="ep-play" type="button" data-play="${esc(e.id)}" aria-label="Resume ${esc(e.title)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10.5-6.5z" fill="currentColor"/></svg>
      </button>
    </div>
  </li>`).join('');
}

/* ══════════════════════════════════════════════════════════
   PLAYER
   ══════════════════════════════════════════════════════════ */
const audio = new Audio();
audio.preload = 'metadata';
audio.hidden = true;
audio.playbackRate = state.rate;
document.body.appendChild(audio);

let saveTimer = 0;

function notePlayback(text) {
  const n = $('#pNote');
  if (!n) return;
  if (text) { n.textContent = text; n.hidden = false; }
  else { n.hidden = true; n.textContent = ''; }
}

function playable() {
  if (window.__dialPlayable !== undefined) return window.__dialPlayable;
  const probe = document.createElement('audio');
  window.__dialPlayable = !!(probe.canPlayType &&
    (probe.canPlayType('audio/mpeg') || probe.canPlayType('audio/mp4') || probe.canPlayType('audio/aac')));
  return window.__dialPlayable;
}

function attemptPlay() {
  const p = audio.play();
  if (p && p.catch) {
    p.catch(err => {
      document.body.classList.remove('is-playing');
      notePlayback(err && err.name === 'NotAllowedError'
        ? 'Blocked by the browser — press play'
        : 'Audio did not start — press play to retry');
    });
  }
  return p;
}

function findEpisode(id) {
  const direct = state.episodes.find(e => String(e.id) === String(id));
  if (direct) return direct;

  const rec = logEntry(id);
  if (!rec) return null;
  return {
    id: rec.id, title: rec.title, url: rec.url, dur: rec.dur, date: '',
    art: rec.art, showId: rec.showId, showName: rec.show
  };
}

function startEpisode(ep) {
  if (!ep || !ep.url) return;
  if (!playable()) { notePlayback('This browser cannot play MP3 audio'); return; }

  state.now = ep;
  audio.src = ep.url;

  $('#player').hidden = false;
  $('#pArt').src = ep.art || '';
  $('#pArt').alt = '';
  $('#pShow').textContent = ep.showName || '';
  $('#pTitle').textContent = ep.title || '';
  $('#tDur').textContent = fmt(ep.dur);
  $('#tCur').textContent = '0:00';
  setSeek(0);
  notePlayback(false);

  audio.addEventListener('loadedmetadata', function once() {
    audio.removeEventListener('loadedmetadata', once);
    const rec = logEntry(ep.id);
    if (rec && rec.pos > 15 && (!ep.dur || rec.pos < ep.dur - 15)) {
      try { audio.currentTime = rec.pos; } catch { /* not buffered yet */ }
    }
    if (!ep.dur && isFinite(audio.duration)) {
      ep.dur = audio.duration;
      $('#tDur').textContent = fmt(ep.dur);
    }
    attemptPlay();
  }, { once: true });

  setMediaSession(ep);
  markCurrent(ep.id);
}

function markCurrent(id) {
  $$('.ep').forEach(li => {
    const on = String(li.dataset.ep) === String(id);
    li.classList.toggle('is-current', on);
    const btn = li.querySelector('.ep-play');
    if (!btn) return;
    const playing = on && !audio.paused;
    btn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5.5" width="3.6" height="13" fill="currentColor"/><rect x="13.4" y="5.5" width="3.6" height="13" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
    btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  });
}

function togglePlay() {
  if (!state.now) return;
  if (audio.paused) attemptPlay();
  else audio.pause();
}

function setSeek(fraction) {
  const seek = $('#seek');
  if (!seek) return;
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  seek.value = String(Math.round(pct * 10));
  seek.style.setProperty('--p', pct.toFixed(2) + '%');
}

function skip(seconds) {
  if (!state.now) return;
  const dur = audio.duration || state.now.dur || 0;
  let t = (audio.currentTime || 0) + seconds;
  if (t < 0) t = 0;
  if (dur && t > dur - 1) t = Math.max(0, dur - 1);
  try { audio.currentTime = t; } catch { /* ignore */ }
  $('#tCur').textContent = fmt(t);
}

audio.addEventListener('play', () => {
  document.body.classList.add('is-playing');
  $('#play').setAttribute('aria-label', 'Pause');
  notePlayback(false);
  markCurrent(state.now && state.now.id);
});
audio.addEventListener('pause', () => {
  document.body.classList.remove('is-playing');
  $('#play').setAttribute('aria-label', 'Play');
  markCurrent(state.now && state.now.id);
  if (state.now) logUpsert(state.now, Math.floor(audio.currentTime || 0));
  renderResumeIfHome();
});
audio.addEventListener('ended', () => {
  if (state.now) logUpsert(state.now, 0);
});

audio.addEventListener('timeupdate', () => {
  if (!state.now) return;
  const cur = audio.currentTime || 0;
  const dur = audio.duration || state.now.dur || 0;
  $('#tCur').textContent = fmt(cur);
  if (isFinite(dur) && dur > 0) {
    setSeek(cur / dur);
    if (!state.now.dur) $('#tDur').textContent = fmt(dur);
  }
  if (Date.now() - saveTimer > 5000) {
    saveTimer = Date.now();
    logUpsert(state.now, Math.floor(cur));
  }
});

audio.addEventListener('error', () => {
  notePlayback('Audio did not load — that host may be unreachable');
  document.body.classList.remove('is-playing');
});

function renderResumeIfHome() {
  if (!$('#view-home').hidden && libraryRequested) renderResume();
}

/* ── media session ───────────────────────────────────────── */
function setMediaSession(ep) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ep.title || '',
      artist: ep.showName || '',
      album: 'DIAL',
      artwork: ep.art ? [{ src: ep.art, sizes: '600x600', type: 'image/jpeg' }] : []
    });
    navigator.mediaSession.setActionHandler('play', () => attemptPlay());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-15));
    navigator.mediaSession.setActionHandler('seekforward', () => skip(30));
  } catch { /* older browsers */ }
}

/* ── rate ────────────────────────────────────────────────── */
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

function paintRate() {
  $('#rate').textContent = state.rate + '×';
}

function cycleRate() {
  const i = RATES.indexOf(state.rate);
  state.rate = RATES[(i + 1) % RATES.length];
  audio.playbackRate = state.rate;
  try { audio.preservesPitch = true; } catch { /* ignore */ }
  paintRate();
  store.set('rate', state.rate);
}

/* ══════════════════════════════════════════════════════════
   ROUTER
   ══════════════════════════════════════════════════════════ */
function route() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '') || '/');
  const parts = raw.split('/').filter(Boolean);

  if (!parts.length) return renderHome();
  if (parts[0] === 'q') {
    const term = parts.slice(1).join('/').trim();
    return term ? renderSearch(term) : renderHome();
  }
  if (parts[0] === 's' && parts[1]) return renderShow(parts[1]);
  if (parts[0] === 'saved') return renderSaved();
  if (parts[0] === 'log') return renderLog();
  return renderHome();
}

window.addEventListener('hashchange', route);

/* ══════════════════════════════════════════════════════════
   EVENTS
   ══════════════════════════════════════════════════════════ */
document.addEventListener('click', e => {
  const chip = e.target.closest('[data-chip]');
  if (chip) { location.hash = '#/q/' + encodeURIComponent(chip.dataset.chip); return; }

  const arrow = e.target.closest('[data-hero]');
  if (arrow) { stepHero(Number(arrow.dataset.hero)); return; }

  const dot = e.target.closest('[data-hero-dot]');
  if (dot) { layoutHero(Number(dot.dataset.heroDot), false); startHeroAuto(); return; }

  const libPlay = e.target.closest('[data-play-show]');
  if (libPlay) { playFromShow(decodeURIComponent(libPlay.dataset.playShow)); return; }

  const playBtn = e.target.closest('[data-play]');
  if (playBtn) {
    const id = playBtn.dataset.play;
    if (state.now && String(state.now.id) === String(id)) togglePlay();
    else {
      const ep = findEpisode(id);
      if (ep) startEpisode(ep);
    }
    return;
  }

  if (e.target.closest('[data-retry]')) {
    if (e.target.closest('#homeLibrary')) { libraryJob=null; ensureHomeLibrary(); }
    else route();
    return;
  }

  if (e.target.closest('#showSave')) {
    if (!state.show) return;
    toggleSaved(state.show);
    paintSave();
    return;
  }

  if (e.target.closest('#showPlayLatest')) {
    if (state.episodes[0]) startEpisode(state.episodes[0]);
    return;
  }

  const nav = e.target.closest('[data-dir]');
  if (nav) {
    const track = $('[data-track]');
    const step = track.clientWidth * 0.9;
    track.scrollBy({ left: step * Number(nav.dataset.dir), behavior: 'smooth' });
    return;
  }

  if (e.target.closest('#burger')) { setMobileNav(true); return; }
  if (e.target.closest('#mobileClose') || e.target.closest('.mobile-nav a')) { setMobileNav(false); return; }
});

function setMobileNav(open) {
  $('#burger').setAttribute('aria-expanded', open ? 'true' : 'false');
  $('#mobileNav').setAttribute('aria-hidden', open ? 'false' : 'true');
  $('#mobileNav').inert = !open;
}

$('#searchForm').addEventListener('submit', e => {
  e.preventDefault();
  const term = $('#q').value.trim();
  if (term) location.hash = '#/q/' + encodeURIComponent(term);
  else $('#q').focus();
});

$('#play').addEventListener('click', togglePlay);
$('#rew').addEventListener('click', () => skip(-15));
$('#ff').addEventListener('click', () => skip(30));
$('#rate').addEventListener('click', cycleRate);

$('#pClose').addEventListener('click', () => {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  state.now = null;
  $('#player').hidden = true;
  document.body.classList.remove('is-playing');
  renderResumeIfHome();
});

$('#seek').addEventListener('input', e => {
  const dur = audio.duration || (state.now && state.now.dur) || 0;
  if (!dur) return;
  const t = (+e.target.value / 1000) * dur;
  e.target.style.setProperty('--p', (+e.target.value / 10).toFixed(2) + '%');
  $('#tCur').textContent = fmt(t);
  try { audio.currentTime = t; } catch { /* ignore */ }
});

/* keyboard */
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (e.key === ' ') { e.preventDefault(); togglePlay(); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-10); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); skip(10); return; }
  if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
  if (e.key === 'Escape') setMobileNav(false);
});

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
function boot() {
  paintRate();
  mountScene();
  renderHome();
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/');
  route();
}

boot();
