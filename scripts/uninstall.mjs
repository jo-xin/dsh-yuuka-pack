#!/usr/bin/env node
/**
 * 优香角色包 —— 卸载脚本
 * 只删本包添加的条目（按 id 匹配），不动用户自己的东西。
 * 用量设置只在「内容与安装时完全一致」时才移除，否则保留并提示。
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE    = dirname(fileURLToPath(import.meta.url));
const ROOT    = dirname(HERE);
const PAYLOAD = join(ROOT, 'payload');
const DSH     = process.env.DSH_HOME || join(homedir(), '.dsh');

const ok   = (s) => console.log('  \x1b[32m✓\x1b[0m ' + s);
const warn = (s) => console.log('  \x1b[33m!\x1b[0m ' + s);
const bad  = (s) => console.log('  \x1b[31m✗\x1b[0m ' + s);

const readJson  = (p, fb) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fb; } };
const writeJson = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2), 'utf8');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const pack = {
  roles:     (readJson(join(PAYLOAD,'whale-roles','roles.json'),       {}).roles     || []).map(x => x.id),
  groups:    (readJson(join(PAYLOAD,'whale-audio','audio.json'),       {}).groups    || []).map(x => x.id),
  fragments: (readJson(join(PAYLOAD,'whale-audio','audio.json'),       {}).fragments || []).map(x => x.id),
  images:    (readJson(join(PAYLOAD,'whale-bubble-imgs','bubble-imgs.json'), {}).images || []).map(x => x.id),
};

console.log('');
console.log('优香角色包 · 卸载');
console.log('─'.repeat(52));

function dropFromIndex(indexPath, key, ids, exts) {
  const cur = readJson(indexPath, null);
  if (!cur) { warn('没有找到 ' + indexPath); return; }
  const before = (cur[key] || []).length;
  cur[key] = (cur[key] || []).filter(x => !ids.includes(x && x.id));
  writeJson(indexPath, cur);
  ok(`${key}: 移除 ${before - cur[key].length} 项，剩 ${cur[key].length} 项`);
  for (const id of ids) for (const ext of exts) {
    const f = join(dirname(indexPath), id + '.' + ext);
    if (existsSync(f)) { unlinkSync(f); ok('删除 ' + id + '.' + ext); }
  }
}

console.log('');
dropFromIndex(join(DSH,'whale-roles','roles.json'),            'roles',     pack.roles,     ['png','gif','jpg','webp']);
dropFromIndex(join(DSH,'whale-audio','audio.json'),             'groups',    pack.groups,    []);
dropFromIndex(join(DSH,'whale-audio','audio.json'),             'fragments', pack.fragments, ['wav','mp3']);
dropFromIndex(join(DSH,'whale-bubble-imgs','bubble-imgs.json'), 'images',    pack.images,    ['png','gif']);

console.log('');
console.log('· 用量设置');
{
  const usagePath = join(DSH, '.dshw-usage.json');
  const srcSet = readJson(join(PAYLOAD, 'dshw-usage-settings.json'), null);
  const led = existsSync(usagePath) ? readJson(usagePath, null) : null;
  if (!srcSet || !led || !led.settings) {
    warn('没有可处理的用量设置，跳过。');
  } else {
    let removed = 0, kept = 0;
    for (const [k, v] of Object.entries(srcSet)) {
      if (k === 'models') {
        for (const [mid, mv] of Object.entries(v)) {
          const cur = led.settings.models && led.settings.models[mid];
          if (!cur) continue;
          for (const mk of Object.keys(mv)) {
            if (cur[mk] === undefined) continue;
            if (eq(cur[mk], mv[mk])) { delete cur[mk]; removed++; ok(`settings.models.${mid}.${mk} 已移除（还原为出厂默认）`); }
            else { kept++; warn(`settings.models.${mid}.${mk} 已被你改过，保留不动。`); }
          }
          if (Object.keys(cur).length === 0) delete led.settings.models[mid];
        }
        if (led.settings.models && Object.keys(led.settings.models).length === 0) delete led.settings.models;
      } else {
        if (led.settings[k] === undefined) continue;
        if (eq(led.settings[k], v)) { delete led.settings[k]; removed++; ok(`settings.${k} 已移除（还原为出厂默认）`); }
        else { kept++; warn(`settings.${k} 已被你改过，保留不动。`); }
      }
    }
    if (removed) writeJson(usagePath, led);
    if (!removed && !kept) warn('没有本包写入的设置。');
  }
}


console.log('');
console.log('· 音效组选择');
{
  const sizePath = join(DSH, '.dshw-size.json');
  const inc = readJson(join(PAYLOAD, 'whale-audio', 'audio.json'), {});
  const want = (inc.groups && inc.groups[0] && inc.groups[0].id) || null;
  const cfg = existsSync(sizePath) ? readJson(sizePath, null) : null;
  if (!want || !cfg) { warn('没有可处理的音效组选择，跳过。'); }
  else if (cfg.soundSet === want) { cfg.soundSet = 'duck'; writeJson(sizePath, cfg); ok('音效组已回退为「小黄鸭」'); }
  else { warn('音效组已被你改过，保留不动。'); }
}

console.log('');
const baks = existsSync(DSH) ? readdirSync(DSH).filter(f => f.includes('.bak-')).sort() : [];
if (baks.length) {
  warn('安装时留的备份：');
  for (const b of baks) warn('    ' + join(DSH, b));
}
console.log('');
