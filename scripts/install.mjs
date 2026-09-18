#!/usr/bin/env node
/**
 * 优香角色包 —— 安装脚本
 * 把 payload/ 里的素材释放到 DSH 数据目录，并【合并】而非覆盖现有索引，
 * 避免冲掉用户自己的角色 / 音效 / 泡泡图 / 用量设置。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE    = dirname(fileURLToPath(import.meta.url));
const ROOT    = dirname(HERE);
const PAYLOAD = join(ROOT, 'payload');
const DSH     = process.env.DSH_HOME || join(homedir(), '.dsh');
const STAMP   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const log  = (s) => console.log(s);
const ok   = (s) => console.log('  \x1b[32m✓\x1b[0m ' + s);
const warn = (s) => console.log('  \x1b[33m!\x1b[0m ' + s);
const bad  = (s) => console.log('  \x1b[31m✗\x1b[0m ' + s);

log('');
log('优香角色包 · 安装');
log('─'.repeat(52));
log('  DSH 数据目录 : ' + DSH);

if (!existsSync(DSH) || !existsSync(join(DSH, 'profiles'))) {
  bad('找不到 DSH 数据目录（或它不是 DSH 的数据目录）。');
  bad('先跑一次 dsh web 让它初始化，再回来装。');
  process.exit(1);
}
if (!existsSync(join(DSH, 'profiles', 'web', 'node_modules', 'dsh-whale-widget'))) {
  warn('没检测到 dsh-whale-widget（右下角挂件）。');
  warn('素材会照常装好，但要先装挂件才看得到：');
  warn('    dsh plugin --profile web add dsh-whale-widget');
  log('');
}

const readJson  = (p, fb) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fb; } };
const writeJson = (p, o) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(o, null, 2), 'utf8'); };

function mergeById(existing, incoming) {
  const out = Array.isArray(existing) ? existing.slice() : [];
  let added = 0, replaced = 0;
  for (const item of incoming) {
    const i = out.findIndex((x) => x && x.id === item.id);
    if (i >= 0) { out[i] = item; replaced++; } else { out.push(item); added++; }
  }
  return { list: out, added, replaced };
}

function installIndexed(dirName, indexName, key, label) {
  log('');
  log(label);
  const srcDir = join(PAYLOAD, dirName);
  const dstDir = join(DSH, dirName);
  mkdirSync(dstDir, { recursive: true });

  for (const f of readdirSync(srcDir)) {
    if (f === indexName) continue;
    copyFileSync(join(srcDir, f), join(dstDir, f));
    ok('复制 ' + f);
  }
  const inc = readJson(join(srcDir, indexName), {});
  const cur = readJson(join(dstDir, indexName), { version: 1 });
  if (key === 'audio-split') {
    const g = mergeById(cur.groups,    inc.groups    || []);
    const f = mergeById(cur.fragments, inc.fragments || []);
    writeJson(join(dstDir, indexName), { version: 1, groups: g.list, fragments: f.list });
    ok(`片段：新增 ${f.added}，替换 ${f.replaced}，共 ${f.list.length} 个`);
    ok(`音效组：新增 ${g.added}，替换 ${g.replaced}，共 ${g.list.length} 组`);
  } else {
    const m = mergeById(cur[key], inc[key] || []);
    writeJson(join(dstDir, indexName), { version: 1, [key]: m.list });
    ok(`索引合并：新增 ${m.added}，替换 ${m.replaced}，共 ${m.list.length} 项`);
  }
}

installIndexed('whale-roles',       'roles.json',       'roles',       '① 角色');
installIndexed('whale-audio',       'audio.json',       'audio-split', '② 音效');
installIndexed('whale-bubble-imgs', 'bubble-imgs.json', 'images',      '③ 泡泡图库');

log('');
log('④ 点击序列（台词 + 表情包）');
{
  const dst = join(DSH, '.dshw-bubble.json');
  if (existsSync(dst)) {
    const bak = dst + '.bak-' + STAMP;
    copyFileSync(dst, bak);
    warn('已存在自定义配置，先备份到：' + bak);
  }
  copyFileSync(join(PAYLOAD, 'dshw-bubble.json'), dst);
  ok('写入 .dshw-bubble.json');
}

log('');
log('⑤ 用量设置（余额预警 / 今日预算）');
{
  const usagePath = join(DSH, '.dshw-usage.json');
  const srcSet = readJson(join(PAYLOAD, 'dshw-usage-settings.json'), null);

  if (!srcSet) {
    warn('payload 里没有用量设置，跳过。');
  } else if (!existsSync(usagePath)) {
    warn('还没有 .dshw-usage.json（跑一次 dsh web 并连上模型后才会生成）。');
    warn('现在跳过 —— 不影响其他部分。');
  } else {
    const led = readJson(usagePath, null);
    if (!led) {
      bad('账本解析失败，为安全起见跳过（没有改动任何东西）。');
    } else {
      const bak = usagePath + '.bak-' + STAMP;
      copyFileSync(usagePath, bak);
      ok('账本已备份：' + bak);

      const b = { todayUsage: led.todayUsage, ev: (led.events || []).length, hi: JSON.stringify(led.history || {}) };

      led.settings = (led.settings && typeof led.settings === 'object') ? led.settings : {};
      let written = 0;
      for (const [k, v] of Object.entries(srcSet)) {
        if (k === 'models') {
          led.settings.models = (led.settings.models && typeof led.settings.models === 'object') ? led.settings.models : {};
          for (const [mid, mv] of Object.entries(v)) {
            led.settings.models[mid] = (led.settings.models[mid] && typeof led.settings.models[mid] === 'object') ? led.settings.models[mid] : {};
            for (const [mk, mvv] of Object.entries(mv)) {
              const had = led.settings.models[mid][mk] !== undefined;
              led.settings.models[mid][mk] = mvv;
              ok(`settings.models.${mid}.${mk} 已${had ? '替换' : '写入'}`);
              written++;
            }
          }
        } else {
          const had = led.settings[k] !== undefined;
          led.settings[k] = v;
          ok(`settings.${k} 已${had ? '替换' : '写入'}`);
          written++;
        }
      }
      if (!written) warn('payload 里没有可写入的设置。');
      writeJson(usagePath, led);

      const a = readJson(usagePath, {});
      const same = a.todayUsage === b.todayUsage && (a.events || []).length === b.ev
                && JSON.stringify(a.history || {}) === b.hi;
      if (same) ok('账本数据复核通过（todayUsage / history / events 未变）');
      else bad('账本数据复核不一致！请用备份恢复：' + bak);
    }
  }
}


log('');
log('⑥ 音效组选择');
{
  const sizePath = join(DSH, '.dshw-size.json');
  const inc = readJson(join(PAYLOAD, 'whale-audio', 'audio.json'), {});
  const want = (inc.groups && inc.groups[0] && inc.groups[0].id) || null;
  const PRESETS = ['duck', 'fx1'];

  if (!want) {
    warn('payload 里没有音效组，跳过。');
  } else if (!existsSync(sizePath)) {
    warn('还没有 .dshw-size.json（跑一次 dsh web 后才会生成）。');
    warn('现在跳过 —— 装完请在 主菜单 → 音效 里手动选「优香」。');
  } else {
    const cfg = readJson(sizePath, null);
    if (!cfg) {
      bad('.dshw-size.json 解析失败，跳过。');
    } else {
      const cur = cfg.soundSet;
      if (cur === want) {
        ok('音效组已经是「优香」，无需改动。');
      } else if (cur === undefined || PRESETS.includes(cur)) {
        const bak = sizePath + '.bak-' + STAMP;
        copyFileSync(sizePath, bak);
        cfg.soundSet = want;
        writeJson(sizePath, cfg);
        ok(`音效组已选中：${cur === undefined ? '(未设置)' : cur}  ->  ${want}`);
      } else {
        warn(`你当前用的是自定义音效组「${cur}」，保留不动。`);
        warn(`想换成「优香」请到 主菜单 → 音效 里选。`);
      }
    }
  }
}

log('');
log('─'.repeat(52));
ok('装完了。');
log('');
log('接下来：');
log('  1. 刷新 dsh web（Ctrl + F5）');
log('  2. 主菜单 → 角色/资源管理 → 选中「优香」');
log('  3. 音效组通常已自动选好；没生效就到 主菜单 → 音效 里选「优香」');
log('  4. 点角色两下 → 第2下台词、第3下表情包');
log('');
