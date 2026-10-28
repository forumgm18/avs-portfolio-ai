// Рендер портфолио из data/cases.json.
// <body data-base=".." data-only="slug,slug"> — base: путь к корню сайта, only: показать часть кейсов.

const MARKED = 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js';
const GALLERY_VISIBLE = 6;

const base = (document.body.dataset.base || '.').replace(/\/$/, '');
const only = document.body.dataset.only?.split(',').map((s) => s.trim());
const url = (path) => `${base}/${path}`;

// h('a.btn', { href }, 'текст', child) — элемент без innerHTML, текст экранируется сам
function h(sel, attrs = {}, ...children) {
  const [tag, ...classes] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return el;
}

const loadScript = (() => {
  const cache = new Map();
  return (src, type) => {
    if (!cache.has(src)) {
      cache.set(src, new Promise((resolve, reject) => {
        const s = h('script', { src, type });
        s.onload = resolve;
        s.onerror = () => reject(new Error(`не загрузился ${src}`));
        document.head.append(s);
      }));
    }
    return cache.get(src);
  };
})();

const pad = (n) => String(n).padStart(2, '0');

/* ---------- профиль ---------- */

function renderProfile(p) {
  document.querySelectorAll('[data-bind]').forEach((el) => {
    el.textContent = p[el.dataset.bind] ?? '';
  });

  document.querySelectorAll('[data-slot="highlights"]').forEach((box) => {
    box.replaceChildren(...p.highlights.map((m) =>
      h('div.metric', {}, h('span.metric__value', {}, m.value), h('span.metric__label', {}, m.label))));
  });

  document.querySelectorAll('[data-slot="stack"]').forEach((box) => {
    box.replaceChildren(...p.stack.map((g) =>
      h('div.stack__group', {},
        h('h3.stack__title', {}, g.group),
        h('ul.chips', {}, g.items.map((i) => h('li.chip', {}, i))))));
  });

  document.querySelectorAll('[data-slot="contacts"]').forEach((box) => {
    box.replaceChildren(...p.contacts.map((c, i) =>
      h(`a.btn${i === 0 ? '.btn--primary' : ''}`, { href: c.href, target: '_blank', rel: 'noopener' },
        h('span.btn__label', {}, c.label), h('span.btn__value', {}, c.value))));
  });
}

/* ---------- кейсы ---------- */

function renderCard(c, i) {
  const wf = [].concat(c.evidence.workflow ?? [])[0];
  const cover = wf?.image.replace('.webp', '-thumb.webp')
    ?? `${c.evidence.gallery[0].src}-thumb.webp`;
  return h('a.card', { href: `#case-${c.slug}` },
    h('div.card__cover', {}, h('img', { src: url(cover), alt: '', loading: 'lazy' })),
    h('div.card__body', {},
      h('span.card__num', {}, pad(i + 1)),
      h('h3.card__title', {}, c.title),
      h('p.card__metric', {}, h('b', {}, c.metrics[0].value), ' ', c.metrics[0].label),
      h('ul.tags', {}, c.tags.map((t) => h('li', {}, t)))));
}

function section(title, ...content) {
  return h('section.case__section', {}, h('h4.case__label', {}, title), ...content);
}

function renderCase(c, i) {
  const ev = c.evidence;
  return h('article.case', { id: `case-${c.slug}` },
    h('header.case__head', {},
      h('span.case__num', {}, pad(i + 1)),
      h('h3.case__title', {}, c.title),
      h('p.case__lead', {}, c.lead),
      h('ul.tags', {}, c.tags.map((t) => h('li', {}, t)))),
    h('div.case__metrics', {}, c.metrics.map((m) =>
      h('div.metric', {}, h('span.metric__value', {}, m.value), h('span.metric__label', {}, m.label)))),
    h('div.case__body', {},
      h('div.case__text', {},
        section('Задача', h('p', {}, c.task)),
        section('Что сделал', h('ul.list', {}, c.done.map((d) => h('li', {}, d)))),
        section('Результат', h('p', {}, c.result)),
        h('section.case__section.case__effect', {},
          h('h4.case__label', {}, 'Эффект для бизнеса ', h('small', {}, 'расчётно')),
          h('p', {}, c.effect)),
        section('Стек', h('ul.chips', {}, c.stack.map((s) => h('li.chip', {}, s))))),
      h('div.case__evidence', {},
        h('h4.case__label', {}, 'Доказательства'),
        [].concat(ev.workflow ?? []).map((wf) => renderWorkflow(wf, c.title)),
        ev.video && renderVideo(ev.video),
        ev.documents && renderDocuments(ev.documents),
        ev.markdown && renderMarkdownLinks(ev.markdown, ev.source),
        ev.gallery && renderGallery(ev.gallery),
        ev.note && h('p.note', {}, ev.note))));
}

function renderWorkflow(wf, title) {
  const full = url(wf.image);
  return h('figure.workflow', {},
    h('button.workflow__img', { type: 'button', 'aria-label': 'Открыть схему', onclick: () => openLightbox([{ src: full, caption: wf.caption }], 0) },
      h('img', { src: url(wf.image.replace('.webp', '-thumb.webp')), alt: wf.caption, loading: 'lazy' })),
    h('figcaption', {}, wf.caption),
    h('div.workflow__actions', {},
      h('button.btn.btn--small', { type: 'button', onclick: () => openWorkflow(url(wf.json), title) }, 'Интерактивная схема'),
      h('a.btn.btn--small.btn--ghost', { href: url(wf.json), download: '' }, 'Скачать JSON')));
}

function renderVideo(v) {
  return h('figure.video', {},
    h('video', { src: url(v.src), poster: url(v.poster), controls: true, playsinline: true, preload: 'none' }),
    h('figcaption', {}, v.caption));
}

function renderDocuments(docs) {
  return h('div.docs', {}, docs.map((d) =>
    h('a.doc', { href: url(d.href), target: '_blank', rel: 'noopener' },
      h('img.doc__cover', { src: url(d.cover), alt: '', loading: 'lazy' }),
      h('span.doc__title', {}, d.title),
      h('span.doc__meta', {}, d.meta))));
}

function renderMarkdownLinks(items, source) {
  return h('div.mdlinks', {},
    source && h('a.source', { href: source.href, target: '_blank', rel: 'noopener' }, source.title),
    h('div.mdlinks__row', {}, items.map((m) =>
      h('button.btn.btn--small', { type: 'button', onclick: () => openMarkdown(url(m.href), m.title) }, m.title))));
}

function renderGallery(items) {
  const slides = items.map((g) => ({ src: url(`${g.src}.webp`), caption: g.caption, tall: g.tall }));
  const thumbs = items.map((g, i) =>
    h(`button.thumb${g.tall ? '.thumb--tall' : ''}`, { type: 'button', hidden: i >= GALLERY_VISIBLE, onclick: () => openLightbox(slides, i) },
      h('img', { src: url(`${g.src}-thumb.webp`), alt: g.caption, loading: 'lazy' }),
      h('span.thumb__caption', {}, g.caption)));
  const grid = h('div.gallery', {}, thumbs);
  const rest = items.length - GALLERY_VISIBLE;
  if (rest <= 0) return grid;
  const more = h('button.btn.btn--small.btn--ghost.gallery__more', {
    type: 'button',
    onclick: () => { thumbs.forEach((t) => { t.hidden = false; }); more.remove(); },
  }, `Ещё ${rest} скринов`);
  return h('div', {}, grid, more);
}

/* ---------- диалоги ---------- */

const lightbox = { slides: [], index: 0 };

function dialogShell(cls) {
  const body = h('div.dialog__body');
  const title = h('h2.dialog__title');
  const dlg = h(`dialog.dialog.${cls}`, {},
    h('header.dialog__bar', {}, title,
      h('button.dialog__close', { type: 'button', 'aria-label': 'Закрыть', onclick: () => dlg.close() }, '×')),
    body);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg);
  return { dlg, body, title };
}

let lb;
function openLightbox(slides, index) {
  if (!lb) {
    lb = dialogShell('lightbox');
    lb.img = h('img');
    lb.caption = h('p.lightbox__caption');
    lb.prev = h('button.lightbox__nav.lightbox__nav--prev', { type: 'button', 'aria-label': 'Назад', onclick: () => step(-1) }, '‹');
    lb.next = h('button.lightbox__nav.lightbox__nav--next', { type: 'button', 'aria-label': 'Вперёд', onclick: () => step(1) }, '›');
    lb.body.append(h('div.lightbox__stage', {}, lb.img), lb.prev, lb.next);
    lb.dlg.querySelector('.dialog__bar').prepend(lb.caption);
    lb.dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }
  lightbox.slides = slides;
  lightbox.index = index;
  showSlide();
  lb.dlg.showModal();
}

function step(d) {
  const n = lightbox.slides.length;
  lightbox.index = (lightbox.index + d + n) % n;
  showSlide();
}

function showSlide() {
  const s = lightbox.slides[lightbox.index];
  lb.img.src = s.src;
  lb.img.alt = s.caption;
  lb.caption.textContent = lightbox.slides.length > 1
    ? `${lightbox.index + 1} / ${lightbox.slides.length} · ${s.caption}` : s.caption;
  lb.dlg.classList.toggle('lightbox--tall', !!s.tall);
  lb.body.scrollTop = 0;
  const multi = lightbox.slides.length > 1;
  lb.prev.hidden = !multi;
  lb.next.hidden = !multi;
}

let wfDialog;
async function openWorkflow(jsonUrl, title) {
  if (!wfDialog) wfDialog = dialogShell('viewer');
  wfDialog.title.textContent = `${title} — схема n8n`;
  wfDialog.body.replaceChildren(h('p.dialog__status', {}, 'Загружаю схему…'));
  wfDialog.dlg.showModal();
  try {
    const [wf] = await Promise.all([
      fetch(jsonUrl).then((r) => r.json()),
      loadScript(url('assets/js/wf-viewer.js')),
    ]);
    const stage = h('div.viewer__stage');
    wfDialog.body.replaceChildren(stage,
      h('p.dialog__hint', {}, 'Тяните схему мышью или пальцем, колесо — масштаб. Клик по ноде показывает промпт, SQL или параметры. Credentials из экспорта удалены.'));
    window.drawN8nWorkflow(stage, wf);
  } catch (err) {
    wfDialog.body.replaceChildren(h('p.dialog__status', {},
      'Не удалось открыть схему. ', h('a', { href: jsonUrl, download: '' }, 'Скачать JSON'), ' и импортировать в свой n8n.'));
    console.error(err);
  }
}

let mdDialog;
async function openMarkdown(mdUrl, title) {
  if (!mdDialog) mdDialog = dialogShell('reader');
  mdDialog.title.textContent = title;
  mdDialog.body.replaceChildren(h('p.dialog__status', {}, 'Загружаю…'));
  mdDialog.dlg.showModal();
  try {
    const [md] = await Promise.all([fetch(mdUrl).then((r) => r.text()), loadScript(MARKED)]);
    const article = h('article.prose');
    // md — собственные файлы конспекта из репозитория, не пользовательский ввод
    article.innerHTML = window.marked.parse(md);
    const abs = new URL(mdUrl, location.href);
    article.querySelectorAll('img').forEach((img) => {
      img.src = new URL(img.getAttribute('src'), abs).href;
      img.loading = 'lazy';
    });
    mdDialog.body.replaceChildren(article);
    mdDialog.body.scrollTop = 0;
  } catch (err) {
    mdDialog.body.replaceChildren(h('p.dialog__status', {}, 'Не удалось загрузить документ.'));
    console.error(err);
  }
}

/* ---------- тема ---------- */

function initTheme() {
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch { /* приватный режим */ }
  if (saved) document.documentElement.dataset.theme = saved;
  btn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* приватный режим */ }
  });
}

/* ---------- старт ---------- */

async function init() {
  initTheme();
  const data = await fetch(url('data/cases.json')).then((r) => r.json());
  renderProfile(data.profile);
  document.querySelector('[data-slot="cards"]')?.replaceChildren(...data.cases.map(renderCard));
  const details = data.cases.map((c, i) => [c, i]).filter(([c]) => !only || only.includes(c.slug));
  document.querySelector('[data-slot="cases"]')?.replaceChildren(...details.map(([c, i]) => renderCase(c, i)));
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

init().catch((err) => {
  console.error(err);
  document.querySelector('[data-slot="cases"]')?.append(h('p.note', {}, 'Не удалось загрузить кейсы.'));
});
