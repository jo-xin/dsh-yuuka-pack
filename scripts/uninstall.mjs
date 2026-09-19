#!/usr/bin/env node
/**
 * 优香角色包 —— 卸载脚本
 *
 * 读 .yuuka-pack-state.json，把安装时改动过的每一处【精确还原】成安装前的样子：
 *   - 索引条目：原来有的还原成原值，原来没有的删掉
 *   - 点击序列：还原成安装前那份（原来没有就删掉）
 *   - 用量设置：还原成安装前的值（原来没有就删掉）
 *   - 音效组选择：还原成安装前的值
 *
 * 你自己在安装之后加的东西不受影响。
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const DSH   = process.env.DSH_HOME || join(homedir(), '.dsh');
const STATE = join(DSH, '.yuuka-pack-state.json');
const FORCE = process.argv.includes('--force-best-effort');

const ok   = (s) => console.log('  \x1b[32m✓\x1b[0m ' + s);
const warn = (s) => console.log('  \x1b[33m!\x1b[0m ' + s);
const bad  = (s) => console.log('  \x1b[31m✗\x1b[0m ' + s);

const readJson  = (p, fb) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fb; } };
const writeJson = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2), 'utf8');

console.log('');
console.log('优香角色包 · 卸载');
console.log('─'.repeat(54));

// ── 前置：必须有状态文件 ──────────────────────────────────────
if (!existsSync(STATE)) {
  bad('找不到 .yuuka-pack-state.json —— 无法精确还原。');
  bad('');
  bad('说明：这份状态文件是安装时写下的，记录了「安装前是什么」。');
  bad('没有它就只能猜，而猜错的代价是删掉你自己的配置。');
  bad('');
  bad('如果你确定是这个包装的、但状态文件丢了，可以用：');
  bad('    uninstall.ps1 --force-best-effort');
  bad('（那个模式只删本包已知的 id，不碰设置 —— 设置得你手动改回去）');
  if (!FORCE) process.exit(1);
  console.log('');
}

const st = existsSync(STATE) ? readJson(STATE, null) : null;
if (st) {
  console.log('  安装时间 : ' + (st.installedAt || '?'));
  console.log('  包版本   : v' + (st.packVersion || '?'));
  console.log('');
}

// 本包拥有的 id：优先从状态文件取，退回从 payload 取
const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PAYLOAD = join(dirname(HERE), 'payload');
const ids = st && st.ids ? st.ids : {
  roles:     (readJson(join(PAYLOAD, 'whale-roles', 'roles.json'),       {}).roles     || []).map((x) => x.id),
  groups:    (readJson(join(PAYLOAD, 'whale-audio', 'audio.json'),       {}).groups    || []).map((x) => x.id),
  fragments: (readJson(join(PAYLOAD, 'whale-audio', 'audio.json'),       {}).fragments || []).map((x) => x.id),
  images:    (readJson(join(PAYLOAD, 'whale-bubble-imgs', 'bubble-imgs.json'), {}).images || []).map((x) => x.id),
};

// ── ①②③ 索引：按状态还原 ─────────────────────────────────────
function restoreIndex(dirName, indexName, key, label, exts) {
  console.log('');
  console.log(label);
  const indexPath = join(DSH, dirName, indexName);
  const cur = readJson(indexPath, null);
  if (!cur) { warn('没有找到 ' + indexPath + '，跳过。'); return; }

  const before = (st && st.before && st.before[key]) || null;
  const keys = [key];

  for (const k of keys) {
    const list = Array.isArray(cur[k]) ? cur[k] : [];
    const owned = ids[k] || [];
    let restored = 0, removed = 0;

    const out = [];
    for (const entry of list) {
      if (!entry || !owned.includes(entry.id)) { out.push(entry); continue; }
      const prev = before ? before[entry.id] : undefined;
      if (prev === undefined || prev === null) { removed++; continue; }   // 原来没有 -> 删
      out.push(prev); restored++;                                          // 原来有 -> 还原
    }
    // 原来有、但当前列表里已经不在的（比如用户手动删了）→ 按状态补回去
    if (before) {
      for (const id of owned) {
        const prev = before[id];
        if (prev && !out.some((x) => x && x.id === id)) { out.push(prev); restored++; }
      }
    }
    cur[k] = out;
    ok(`${k}: 还原 ${restored} 项，移除 ${removed} 项，剩 ${out.length} 项`);
  }

  cur.version = 1;
  writeJson(indexPath, cur);

  for (const id of (ids[key] || [])) {
    for (const ext of exts) {
      const f = join(DSH, dirName, id + '.' + ext);
      if (existsSync(f)) { unlinkSync(f); ok('删除 ' + id + '.' + ext); }
    }
  }
}

restoreIndex('whale-roles',       'roles.json',       'roles',     '① 角色',      ['png','gif','jpg','webp']);
restoreIndex('whale-audio',       'audio.json',       'groups',    '② 音效组',    []);
restoreIndex('whale-audio',       'audio.json',       'fragments', '② 音效片段',  ['wav','mp3']);
restoreIndex('whale-bubble-imgs', 'bubble-imgs.json', 'images',    '③ 泡泡图库',  ['png','gif']);

// ── ④ 点击序列 ────────────────────────────────────────────────
console.log('');
console.log('④ 点击序列');
{
  const dst = join(DSH, '.dshw-bubble.json');
  const prev = st && st.before ? st.before.bubbleConfig : undefined;
  if (prev === undefined) {
    warn('状态文件里没记录点击序列，跳过（不动）。');
  } else if (prev === null) {
    if (existsSync(dst)) { rmSync(dst); ok('原先没有配置 → 已删除 .dshw-bubble.json（回出厂默认）'); }
    else warn('原先没有配置，现在也没有，无需处理。');
  } else {
    writeJson(dst, prev);
    ok('已还原为安装前的点击序列');
  }
}

// ── ⑤ 用量设置 ────────────────────────────────────────────────
console.log('');
console.log('⑤ 用量设置');
{
  const usagePath = join(DSH, '.dshw-usage.json');
  const before = st && st.before ? st.before.usageSettings : undefined;

  if (before === undefined) {
    warn('状态文件里没记录用量设置，跳过（你的设置保持现状）。');
  } else if (!existsSync(usagePath)) {
    warn('账本文件不存在，跳过。');
  } else {
    const led = readJson(usagePath, null);
    if (!led) { bad('账本解析失败，跳过。'); }
    else {
      const b = {
        todayUsage: led.todayUsage,
        ev: (led.events || []).length,
        hi: JSON.stringify(led.history || {}),
      };
      led.settings = (led.settings && typeof led.settings === 'object') ? led.settings : {};

      let restored = 0, removed = 0;
      for (const [path, prev] of Object.entries(before)) {
        const parts = path.split('.');
        if (parts[0] === 'models' && parts.length === 3) {
          const [, mid, mk] = parts;
          const box = led.settings.models && led.settings.models[mid];
          if (!box) continue;
          if (prev === null || prev === undefined) { delete box[mk]; removed++; ok(`${path} 原先没有 → 已删除`); }
          else { box[mk] = prev; restored++; ok(`${path} 已还原`); }
        } else {
          if (prev === null || prev === undefined) { delete led.settings[path]; removed++; ok(`${path} 原先没有 → 已删除`); }
          else { led.settings[path] = prev; restored++; ok(`${path} 已还原`); }
        }
      }
      // 清理空壳
      if (led.settings.models) {
        for (const mid of Object.keys(led.settings.models)) {
          if (led.settings.models[mid] && Object.keys(led.settings.models[mid]).length === 0) delete led.settings.models[mid];
        }
        if (Object.keys(led.settings.models).length === 0) delete led.settings.models;
      }
      writeJson(usagePath, led);

      const a = readJson(usagePath, {});
      const same = a.todayUsage === b.todayUsage
                && (a.events || []).length === b.ev
                && JSON.stringify(a.history || {}) === b.hi;
      if (same) ok('账本数据复核通过（todayUsage / history / events 未变）');
      else bad('账本数据复核不一致！');
      console.log('    （还原 ' + restored + ' 项，删除 ' + removed + ' 项）');
    }
  }
}

// ── ⑥ 音效组选择 ──────────────────────────────────────────────
console.log('');
console.log('⑥ 音效组选择');
{
  const sizePath = join(DSH, '.dshw-size.json');
  const prev = st && st.before ? st.before.soundSet : undefined;
  if (prev === undefined) {
    warn('状态文件里没记录音效组，跳过。');
  } else if (!existsSync(sizePath)) {
    warn('.dshw-size.json 不存在，跳过。');
  } else {
    const cfg = readJson(sizePath, null);
    if (!cfg) { bad('解析失败，跳过。'); }
    else if (prev === null || prev === undefined) { delete cfg.soundSet; writeJson(sizePath, cfg); ok('原先未设置 → 已删除（回默认 duck）'); }
    else { cfg.soundSet = prev; writeJson(sizePath, cfg); ok('已还原为 ' + prev); }
  }
}

// ── 收尾 ──────────────────────────────────────────────────────
if (st) {
  rmSync(STATE);
  console.log('');
  ok('已清除状态文件 .yuuka-pack-state.json');
}
console.log('');
console.log('─'.repeat(54));
ok('卸完了。刷新 dsh web（Ctrl + F5）生效。');
console.log('');
console.log('  安装时留的 .bak-* 备份还在（想核对可以看）：');
const baks = existsSync(DSH) ? readdirSync(DSH).filter((f) => f.includes('.bak-')) : [];
for (const b of baks) console.log('    ' + b);
if (!baks.length) console.log('    （无）');
console.log('');
