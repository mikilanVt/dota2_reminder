import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {itemDescription} from './item-shop-data.mjs';
import * as authored from '../data-sources/item-quiz-editorial.mjs';

const root = new URL('../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const snapshotPath = 'data-sources/valve-item-shop-2026-09-10.json.gz';
const snapshot = JSON.parse(gunzipSync(readFileSync(new URL(snapshotPath, root))));
const catalog = read('src/data/item-shop-catalog.json');
const times = read('data-sources/neutral-item-times-2026-09-10.json');
if (snapshot.patchContext !== catalog.patch || times.patch !== catalog.patch || authored.patch !== catalog.patch)
  throw new Error('Quiz sources belong to different patches.');

// Only current shop items and the current neutral pool. Archive rewards,
// recipes and enchantments with unspecified tier-dependent values are excluded.
const groups = catalog.groups.filter(group => !['special', 'enhancements'].includes(group.id));
const rawById = new Map(snapshot.items.map(record => {
  if (createHash('sha256').update(record.raw).digest('hex') !== record.sha256)
    throw new Error(`Damaged source: ${record.id}`);
  return [record.id, {...record, parsed: JSON.parse(record.raw).result.data.items[0]}];
}));
const items = [];
const audit = [];
const excluded = [];
const oldStats = new Set(['faerie_fire.bonus_damage', 'branches.bonus_all_stats']);
const disallowedStat = /range|aoe|радиус|дальност|обзор/i;
const dispelAnswers = ['Обычным или сильным развеиванием', 'Только сильным развеиванием', 'Развеять нельзя'];
const dispelValue = {1: dispelAnswers[1], 2: dispelAnswers[0], 3: dispelAnswers[2]};

for (const group of groups) for (const entry of group.items) {
  const record = rawById.get(entry.id);
  if (!record) throw new Error(`Missing item source: ${entry.key}`);
  const raw = record.parsed;
  const detail = itemDescription(raw, record.retrievedAt);
  const item = {id: entry.id, key: entry.key, name: entry.name, icon: entry.icon, date: record.retrievedAt, rows: []};
  const add = row => {
    if (item.rows.some(existing => existing.key === row.key)) throw new Error(`Duplicate fact: ${entry.key}.${row.key}`);
    item.rows.push(row);
    audit.push({id: `item_${entry.key}.${row.key}`, kind: row.kind, source: record.source, sha256: record.sha256,
      evidence: row.evidence ?? ({recognition: 'name_loc', price: 'item_cost', mana: 'mana_costs[0]', cooldown: 'cooldowns[0]', tier: 'item_neutral_tier + 1', timing: 'neutral-item-times'}[row.kind] ?? `special_values.${row.key}`), value: row.value});
  };
  add({key: 'recognition', kind: 'recognition', value: entry.name});
  if (!group.tier) add({key: 'price', kind: 'price', value: raw.item_cost});
  if (group.tier) {
    if (raw.item_neutral_tier + 1 !== group.tier || group.unlockTime !== `${times.times[group.tier - 1]}:00`)
      throw new Error(`Neutral tier/time conflict: ${entry.key}`);
    add({key: 'tier', kind: 'tier', value: group.tier});
    add({key: 'timing', kind: 'timing', value: times.times[group.tier - 1]});
  }
  for (const field of raw.special_values) {
    if (!field.heading_loc) continue;
    if (!field.heading_loc.startsWith('+') || disallowedStat.test(field.heading_loc)
      || field.values_float.length !== 1 || field.values_float[0] <= 0
      || oldStats.has(`${entry.key}.${field.name}`) || field.required_facet) {
      excluded.push({item: entry.key, field: field.name, reason: 'Not a single unconditional allowed bonus (or already in the original bank).'});
      continue;
    }
    const index = raw.special_values.filter(value => value.heading_loc && value.values_float.length).indexOf(field);
    const stat = detail.stats[index];
    if (!stat || stat.label.includes('Параметр')) throw new Error(`Untranslated stat: ${entry.key}.${field.name}`);
    const regen = /\$(?:hp_regen|mana_regen)$/.test(field.heading_loc);
    const conditions = entry.key === 'tranquil_boots' ? 'Ботинки не сломаны. Без других источников бонуса.'
      : entry.key === 'moon_shard' ? 'Предмет лежит в активном инвентаре и ещё не поглощён.'
      : entry.key === 'desolator' ? 'Начальный бонус, без прибавки за убийства.'
      : entry.key === 'armlet' ? 'Переключаемый эффект выключен.' : undefined;
    add({key: field.name, kind: 'stats', value: field.values_float[0], label: stat.label,
      unit: field.is_percentage ? '%' : regen ? 'ед./сек.' : 'ед.', ...(conditions && {conditions})});
  }
  const active = /<h[1-6]>\s*(Активное|Использование|Переключаемое)/i.test(raw.desc_loc);
  if (active && raw.mana_costs.length === 1 && Number.isFinite(raw.mana_costs[0]))
    add({key: 'mana', kind: 'mana', value: raw.mana_costs[0]});
  // Zero cooldown on a charge-based item is not its charge recovery time.
  if (active && raw.cooldowns.length === 1 && raw.cooldowns[0] > 0)
    add({key: 'cooldown', kind: 'cooldown', value: raw.cooldowns[0]});
  const context = authored.dispelContexts[entry.key];
  if (context) {
    if (!dispelValue[raw.dispellable]) throw new Error(`Unknown dispel value: ${entry.key}`);
    add({key: 'dispel', kind: 'dispel', value: dispelValue[raw.dispellable], label: context,
      choices: dispelAnswers.filter(answer => answer !== dispelValue[raw.dispellable]), evidence: 'dispellable',
      ...(entry.key === 'dust' && {conditions: 'Оставшийся эффект после выхода из области действия пыли.'})});
  }
  for (const authoredRow of authored.numeric.filter(row => row.item === entry.key)) {
    const {item: _item, field, index, absolute, ...row} = authoredRow;
    const values = field === 'cooldowns' ? raw.cooldowns : field === 'mana_costs' ? raw.mana_costs
      : raw.special_values.find(value => value.name === field)?.values_float;
    if (!values || (index === undefined && values.length !== 1)) throw new Error(`Ambiguous editorial value: ${entry.key}.${field}`);
    const value = values[index ?? 0];
    if (!Number.isFinite(value)) throw new Error(`Missing editorial value: ${entry.key}.${field}`);
    add({...row, key: row.key ?? field, kind: row.kind ?? 'effect', value: absolute ? Math.abs(value) : value,
      evidence: `${field === 'cooldowns' || field === 'mana_costs' ? '' : 'special_values.'}${field}[${index ?? 0}]${absolute ? ':magnitude' : ''}`});
  }
  for (const authoredRow of authored.text.filter(row => row.item === entry.key)) {
    const {item: _item, quote, ...row} = authoredRow;
    const source = [raw.desc_loc, ...raw.notes_loc].join('\n').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
    if (!source.includes(quote)) throw new Error(`Unmatched editorial evidence: ${entry.key}.${row.key}: ${quote}`);
    add({...row, evidence: `desc_loc/notes_loc: ${quote}`});
  }
  items.push(item);
}

const output = {patch: catalog.patch, items};
const outputPath = 'src/data/item-quiz.generated.json';
const serialized = JSON.stringify(output) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(new URL(outputPath, root), 'utf8') !== serialized) throw new Error('Regenerate item-quiz.generated.json.');
} else writeFileSync(new URL(outputPath, root), serialized);
const counts = Object.fromEntries([...new Set(audit.map(row => row.kind))].map(kind => [kind, audit.filter(row => row.kind === kind).length]));
console.log(JSON.stringify({items: items.length, generatedQuestions: audit.length, originalQuestions: 14, total: audit.length + 14, counts, bytes: Buffer.byteLength(serialized)}));
if (process.argv.includes('--audit')) {
  mkdirSync(new URL('tmp/quiz/', root), {recursive: true});
  writeFileSync(fileURLToPath(new URL('tmp/quiz/audit.json', root)), JSON.stringify({audit, excluded}, null, 2));
}
