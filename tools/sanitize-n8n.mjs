#!/usr/bin/env node
// Очищает экспорт n8n-воркфлоу перед публикацией:
// убирает id/имена credentials, webhookId, instanceId, pinData и служебные id,
// подменяет e-mail на example-адрес (контакты тестового магазина в промптах фейковые и остаются).
// Использование: node tools/sanitize-n8n.mjs <src.json> <dst.json>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [src, dst] = process.argv.slice(2);
if (!src || !dst) {
  console.error('usage: sanitize-n8n.mjs <src.json> <dst.json>');
  process.exit(1);
}

const wf = JSON.parse(readFileSync(src, 'utf8'));

const nodes = wf.nodes.map((node) => {
  const clean = { ...node };
  delete clean.webhookId;
  if (clean.credentials) {
    clean.credentials = Object.fromEntries(
      Object.keys(clean.credentials).map((type) => [type, { id: '', name: type }]),
    );
  }
  return clean;
});

const out = {
  name: wf.name,
  nodes,
  connections: wf.connections,
  settings: wf.settings ?? {},
};

const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const text = JSON.stringify(out, null, 2).replace(emailRe, 'shop@example.ru');

const leftovers = text.match(/"(webhookId|instanceId)"|"credentials":\s*\{\s*"[^"]+":\s*\{\s*"id":\s*"[^"]/g);
if (leftovers) {
  console.error('sanitize failed, leftovers:', leftovers);
  process.exit(2);
}

mkdirSync(dirname(dst), { recursive: true });
writeFileSync(dst, text + '\n');
console.log(`${src} -> ${dst} (${nodes.length} nodes)`);
