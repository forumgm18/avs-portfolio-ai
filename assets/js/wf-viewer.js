// Собственный просмотрщик n8n-воркфлоу: рисует ноды и связи из экспортированного JSON в SVG.
// Панорама — перетаскиванием, зум — колесом/кнопками, клик по ноде — параметры (промпт, SQL, код).
// window.drawN8nWorkflow(container, workflowObject)

(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const NODE = 100;      // размер обычной ноды на канвасе n8n
  const SUB = 80;        // диаметр под-ноды (модель, память, инструмент)

  // [подпись на ноде, категория цвета]
  const KINDS = [
    [/telegram/i, 'TG', 'channel'],
    [/gmail/i, 'MAIL', 'channel'],
    [/webhook|respondToWebhook/i, 'HOOK', 'trigger'],
    [/scheduleTrigger/i, 'CRON', 'trigger'],
    [/manualTrigger/i, 'RUN', 'trigger'],
    [/\.agent$/i, 'AI', 'ai'],
    [/lmChat|openAi/i, 'LLM', 'model'],
    [/memory/i, 'MEM', 'model'],
    [/outputParser/i, 'JSON', 'model'],
    [/postgres/i, 'SQL', 'data'],
    [/redis/i, 'REDIS', 'data'],
    [/amocrm/i, 'CRM', 'api'],
    [/executeWorkflow|toolWorkflow/i, 'FLOW', 'logic'],
    [/noOp/i, 'END', 'logic'],
    [/dataTable/i, 'TABLE', 'data'],
    [/s3/i, 'S3', 'data'],
    [/heygen/i, 'VIDEO', 'api'],
    [/httpRequest/i, 'HTTP', 'api'],
    [/\.code$/i, 'JS', 'logic'],
    [/\.if$|\.switch$|\.filter$/i, 'IF', 'logic'],
    [/\.set$|splitOut|convertToFile/i, 'DATA', 'logic'],
    [/\.wait$/i, 'WAIT', 'logic'],
    [/stopAndError/i, 'STOP', 'error'],
  ];

  const kindOf = (type) => {
    const k = KINDS.find(([re]) => re.test(type));
    return k ? { label: k[1], cat: k[2] } : { label: type.split('.').pop().slice(0, 4).toUpperCase(), cat: 'logic' };
  };

  const isSub = (n) => /lmChat|memory|outputParser|Tool$|toolWorkflow|embeddings|vectorStore/i.test(n.type)
    && !/\.agent$/.test(n.type);

  const el = (tag, attrs = {}, text) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };

  const short = (s, max) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

  // Самое содержательное в параметрах ноды — то, что стоит показать человеку
  function details(node) {
    const p = node.parameters || {};
    const blocks = [];
    const push = (title, value) => {
      if (typeof value === 'string' && value.trim()) blocks.push([title, value.replace(/^=/, '')]);
    };
    push('Системный промпт', p.options?.systemMessage);
    push('Запрос к агенту', p.text);
    push('Описание инструмента', p.toolDescription);
    push('SQL', p.query);
    push('Код', p.jsCode);
    push('JSON-схема ответа', p.jsonSchemaExample || p.inputSchema);
    push('Сообщение', p.message || p.text);
    push('URL', p.url);
    if (node.type.includes('stickyNote')) push('Заметка', p.content);
    if (!blocks.length) blocks.push(['Параметры', JSON.stringify(p, null, 2)]);
    return blocks.filter(([t, v], i, arr) => arr.findIndex(([, v2]) => v2 === v) === i);
  }

  window.drawN8nWorkflow = function drawN8nWorkflow(container, wf) {
    const nodes = wf.nodes.filter((n) => !n.type.includes('stickyNote'));
    const stickies = wf.nodes.filter((n) => n.type.includes('stickyNote'));
    const byName = new Map(nodes.map((n) => [n.name, n]));
    const size = (n) => (isSub(n) ? SUB : NODE);
    const center = (n) => [n.position[0] + size(n) / 2, n.position[1] + size(n) / 2];

    // границы канваса
    const boxes = [
      ...nodes.map((n) => [n.position[0], n.position[1], size(n), size(n) + 40]),
      ...stickies.map((s) => [s.position[0], s.position[1], s.parameters.width || 240, s.parameters.height || 160]),
    ];
    const minX = Math.min(...boxes.map((b) => b[0])) - 60;
    const minY = Math.min(...boxes.map((b) => b[1])) - 60;
    const maxX = Math.max(...boxes.map((b) => b[0] + b[2])) + 60;
    const maxY = Math.max(...boxes.map((b) => b[1] + b[3])) + 60;

    const svg = el('svg', { class: 'wf__svg', role: 'img', 'aria-label': `Схема воркфлоу ${wf.name}` });
    const world = el('g');
    svg.append(world);

    for (const s of stickies) {
      const w = s.parameters.width || 240;
      const hgt = s.parameters.height || 160;
      const title = (s.parameters.content || '').split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '') || '';
      world.append(
        el('rect', { class: 'wf__sticky', x: s.position[0], y: s.position[1], width: w, height: hgt, rx: 8 }),
        el('text', { class: 'wf__sticky-title', x: s.position[0] + 14, y: s.position[1] + 26 }, short(title, Math.floor(w / 9))),
      );
    }

    const edges = el('g');
    world.append(edges);
    for (const [from, outputs] of Object.entries(wf.connections)) {
      const src = byName.get(from);
      if (!src) continue;
      for (const [ctype, branches] of Object.entries(outputs)) {
        branches.forEach((targets, outIdx) => {
          (targets || []).forEach((t) => {
            const dst = byName.get(t.node);
            if (!dst) return;
            let d;
            if (ctype === 'main') {
              const n = branches.length;
              const y1 = src.position[1] + NODE / 2 + (n > 1 ? (outIdx - (n - 1) / 2) * 24 : 0);
              const x1 = src.position[0] + size(src);
              const x2 = dst.position[0];
              const y2 = dst.position[1] + size(dst) / 2;
              const dx = Math.max(60, Math.abs(x2 - x1) / 2);
              d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
            } else {
              // под-нода подключается снизу к агенту
              const [x1, y1c] = center(src);
              const y1 = y1c - SUB / 2;
              const [x2] = center(dst);
              const y2 = dst.position[1] + size(dst);
              d = `M${x1},${y1} C${x1},${y1 - 60} ${x2},${y2 + 60} ${x2},${y2}`;
            }
            edges.append(el('path', { d, class: `wf__edge${ctype === 'main' ? '' : ' wf__edge--ai'}` }));
          });
        });
      }
    }

    const panel = document.createElement('aside');
    panel.className = 'wf__panel';
    panel.hidden = true;

    const showNode = (n, g) => {
      world.querySelectorAll('.wf__node--active').forEach((x) => x.classList.remove('wf__node--active'));
      g.classList.add('wf__node--active');
      panel.replaceChildren();
      const head = document.createElement('header');
      head.className = 'wf__panel-head';
      const name = document.createElement('strong');
      name.textContent = n.name;
      const type = document.createElement('code');
      type.textContent = n.type.replace(/^@?n8n\/n8n-nodes-|^n8n-nodes-/, '');
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'wf__panel-close';
      close.setAttribute('aria-label', 'Закрыть');
      close.textContent = '×';
      close.onclick = () => { panel.hidden = true; g.classList.remove('wf__node--active'); };
      head.append(name, type, close);
      panel.append(head);
      for (const [title, value] of details(n)) {
        const h = document.createElement('h5');
        h.textContent = title;
        const pre = document.createElement('pre');
        pre.textContent = value;
        panel.append(h, pre);
      }
      panel.hidden = false;
      panel.scrollTop = 0;
    };

    for (const n of nodes) {
      const k = kindOf(n.type);
      const s = size(n);
      const [cx, cy] = center(n);
      const g = el('g', { class: `wf__node wf__node--${k.cat}${n.disabled ? ' wf__node--off' : ''}`, tabindex: 0 });
      g.append(isSub(n)
        ? el('circle', { cx, cy, r: s / 2 })
        : el('rect', { x: n.position[0], y: n.position[1], width: s, height: s, rx: 14 }));
      g.append(el('text', { class: 'wf__icon', x: cx, y: cy + 6 }, k.label));
      g.append(el('text', { class: 'wf__name', x: cx, y: n.position[1] + s + 22 }, short(n.name, 22)));
      const title = el('title', {}, `${n.name} — ${n.type}`);
      g.append(title);
      g.addEventListener('click', (e) => { e.stopPropagation(); if (!moved) showNode(n, g); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter') showNode(n, g); });
      world.append(g);
    }

    // панорама и зум через viewBox
    let vb = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    const full = { ...vb };
    const apply = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const zoom = (f, px = 0.5, py = 0.5) => {
      const w = Math.min(full.w * 4, Math.max(200, vb.w * f));
      const hgt = vb.h * (w / vb.w);
      vb = { x: vb.x + (vb.w - w) * px, y: vb.y + (vb.h - hgt) * py, w, h: hgt };
      apply();
    };
    apply();

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }, { passive: false });

    let drag = null;
    let moved = false;
    svg.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, vb: { ...vb } };
      moved = false;
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) svg.setPointerCapture(e.pointerId);
      moved = true;
      svg.classList.add('wf__svg--drag');
      const r = svg.getBoundingClientRect();
      const scale = Math.max(vb.w / r.width, vb.h / r.height);
      vb = { ...vb, x: drag.vb.x - dx * scale, y: drag.vb.y - dy * scale };
      apply();
    });
    const end = () => { drag = null; svg.classList.remove('wf__svg--drag'); };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    const btn = (label, aria, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-label', aria);
      b.onclick = fn;
      return b;
    };
    const controls = document.createElement('div');
    controls.className = 'wf__controls';
    controls.append(
      btn('+', 'Приблизить', () => zoom(1 / 1.3)),
      btn('−', 'Отдалить', () => zoom(1.3)),
      btn('⤢', 'Показать всё', () => { vb = { ...full }; apply(); }),
    );

    const stage = document.createElement('div');
    stage.className = 'wf';
    stage.append(svg, controls, panel);
    container.replaceChildren(stage);
  };
})();
