import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {notes, itemNotes, situationalPriority} from '../data-sources/hero-guide-notes.mjs';

const root = new URL('../', import.meta.url);
const readJson = async path => {
  const bytes = await readFile(new URL(path, root));
  return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8'));
};
const roleNames = {Carry: '1 · КЕРРИ', Mid: '2 · МИД', Offlane: '3 · ОФФЛЕЙН', Support: '4 · ПОДДЕРЖКА', 'Hard Support': '5 · ПОДДЕРЖКА'};
// D2PT uses display slugs for these two items; Valve uses internal names.
export const itemKey = key => ({parasma: 'devastator', khanda: 'angels_demise'}[key] ?? key);
const unique = list => [...new Map(list.map(item => [itemKey(item.key), item])).values()];
const chapterTitles = ['ЛИНИЯ', 'ФАРМ И КАРТА', 'ДРАКА', 'ЧАСТАЯ ОШИБКА'];
const pickRate = choice => Number(choice.text.match(/Pick ([\d.]+)%/)?.[1]);
const firstLine = text => text.split('\n')[0].trim();
const talentAt = (hero, level, side) => hero.talents.filter(t => t.level === level)[side === 'left' ? 1 : 0];
const stats = text => {
  const matches = Number(text.match(/(\d+) matches/)?.[1]);
  const winRate = Number(text.match(/([\d.]+)% win/)?.[1]);
  if (!Number.isInteger(matches) || matches < 1 || !Number.isFinite(winRate) || winRate < 0 || winRate > 100)
    throw new Error(`Invalid sample: ${text}`);
  return {matches, winRate};
};
const matchCount = count => `${count.toLocaleString('ru-RU')} ${{one: 'матч', few: 'матча', many: 'матчей', other: 'матча'}[new Intl.PluralRules('ru-RU').select(count)]}`;
const sampleText = sample => `${matchCount(sample.matches)}, ${sample.winRate.toLocaleString('ru-RU')}% побед`;

function itemReason(key, hero, advice) {
  if (itemNotes[hero.key]?.[key]) return itemNotes[hero.key][key];
  if (key === 'ultimate_scepter' || key === 'aghanims_shard') {
    const kind = key === 'ultimate_scepter' ? 'scepter' : 'shard';
    const upgrades = hero.abilities.flatMap(ability => ability.upgrades.filter(u => u.kind === kind && !u.unresolved)
      .map(u => `${ability.name}: ${u.text.replaceAll('\n', ' ')}`));
    if (upgrades.length) return [...new Set(upgrades)].join(' ');
    const granted = hero.abilities.filter(a => a.grantedBy === kind && !a.unresolved);
    if (granted.length) return granted.map(a => `${a.name}: ${a.description.replaceAll('\n', ' ')}`).join(' ');
  }
  if (!advice[key]) throw new Error(`Missing item explanation: ${key}`);
  return [advice[key].purpose, advice[key].tips[0], advice[key].caution].filter(Boolean).join(' ');
}

export function buildGuide(hero, source, advice, editorial = notes[hero.key]) {
  if (source.name !== hero.englishName || source.patch !== hero.patch) throw new Error(`Wrong source for ${hero.key}`);
  if (!editorial || editorial.length !== 5) throw new Error(`Missing editorial: ${hero.key}`);
  const role = source.role?.split('\n')[1];
  if (!roleNames[role]) throw new Error(`Unknown role: ${role}`);
  if (source.skills.length !== 10 || source.talents.length !== 4) throw new Error(`Incomplete build: ${hero.key}`);
  const buildSample = stats(source.builds[0].replaceAll('\n', ' '));
  const skillSample = stats(source.skillSample);
  const startingSample = stats(source.startingSample.replaceAll('\n', ' '));
  const talentChoices = [], talentPickRates = {}, talentLabels = {};
  for (const row of [...source.talents].sort((a, b) => a.level - b.level)) {
    if (row.choices.length !== 2 || row.choices.some(choice => !Number.isFinite(pickRate(choice)) || pickRate(choice) < 0 || pickRate(choice) > 100))
      throw new Error(`Invalid talents: ${hero.key}`);
    const choice = [...row.choices].sort((a, b) => pickRate(b) - pickRate(a))[0];
    const talent = talentAt(hero, row.level, choice.side);
    if (!talent) throw new Error(`Unmapped talent: ${hero.key}/${row.level}`);
    talentChoices.push(talent.key);
    talentPickRates[talent.key] = pickRate(choice);
    // These two Valve localization tokens are unresolved in the base cards.
    // The guide's independently observed D2PT label supplies the value, without
    // rewriting the Valve snapshot or pretending it came from Valve.
    if (talent.unresolved && firstLine(choice.text) === '+125 Reel In Pull Speed')
      talentLabels[talent.key] = '+125 к скорости притягивания у Reel In';
    if (talent.unresolved && firstLine(choice.text) === '-0.5s Keen Conveyance Channel Time')
      talentLabels[talent.key] = '−0,5 сек. применения Keen Conveyance';
  }
  const skillOrder = source.skills.map((step, index) => {
    if (step.level !== index + 1) throw new Error(`Wrong skill level: ${hero.key}`);
    if (hero.abilities.some(a => a.key === step.key)) return step.key;
    if (step.key !== 'attribute_bonus') throw new Error(`Unknown skill: ${step.key}`);
    const row = source.talents.find(row => row.choices.some(choice => firstLine(choice.text) === step.name));
    if (row) {
      if (row.level > step.level) throw new Error(`Talent too early: ${hero.key}`);
      const choice = row.choices.find(choice => firstLine(choice.text) === step.name);
      return talentAt(hero, row.level, choice.side).key;
    }
    if (!/attribute/i.test(step.name)) throw new Error(`Unmapped bonus: ${hero.key}/${step.name}`);
    return 'attribute_bonus';
  });
  const itemStats = new Map(source.items.map(item => [itemKey(item.key), item]));
  const makeItem = item => {
    const key = itemKey(item.key);
    const stat = itemStats.get(key);
    const rate = stat?.text.match(/\n([\d.]+)%/);
    const minute = (item.timing ?? stat?.text)?.match(/(?:^|\n)(\d+)m/);
    return {key, name: item.name ?? firstLine(item.label).split('. ')[0],
      ...(minute ? {timing: `≈ ${minute[1]} мин`} : {}),
      ...(rate ? {purchaseRate: Number(rate[1])} : {}), reason: itemReason(key, hero, advice)};
  };
  const starting = [];
  for (const item of source.starting) {
    const key = itemKey(item.key);
    const existing = starting.find(i => i.key === key);
    const charges = Number(item.label.match(/(\d+) charges/)?.[1]) || 0;
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + 1;
      if (charges) existing.charges = (existing.charges ?? 0) + charges;
    } else {
      const entry = makeItem(item);
      delete entry.timing;
      delete entry.purchaseRate;
      starting.push({...entry, ...(charges ? {charges} : {})});
    }
  }
  // Intermediate Dagon upgrades stay collapsed to the base item. Repeated Shard
  // rows in the provider UI do not mean buying multiple Shards.
  const core = unique(source.core.filter(i => /CORE/.test(i.timing) && !/^dagon_\d/.test(i.key))).map(makeItem);
  const used = new Set([...starting, ...core].map(i => i.key));
  const priorities = situationalPriority[hero.key] ?? [];
  const priority = key => priorities.includes(itemKey(key)) ? priorities.indexOf(itemKey(key)) : priorities.length;
  const options = unique(source.items).filter(i => !used.has(itemKey(i.key)) && !/^dagon_\d/.test(i.key))
    .map(i => ({...i, rate: Number(i.text.match(/\n([\d.]+)%/)?.[1]) || 0}))
    .sort((a, b) => priority(a.key) - priority(b.key) || b.rate - a.rate).slice(0, 8).map(makeItem);
  if (!starting.length || !core.length || !options.length) throw new Error(`Empty item group: ${hero.key}`);
  const groups = [
    {title: 'СТАРТОВЫЙ ЗАКУП', note: `Частый вариант: ${matchCount(startingSample.matches)}. Количество зарядов расходников показано в описании.`, items: starting},
    {title: 'ОСНОВА · ПО ПОРЯДКУ ПОКУПКИ', note: 'Частые покупки выбранной сборки. Компонент и его улучшение показаны последовательно, это не отдельные финальные слоты.', items: core},
    {title: 'ПО СИТУАЦИИ', items: options}
  ];
  if (hero.key === 'lone_druid') groups[1].note += ' У героя и медведя отдельные инвентари; эта сводка не распределяет покупки между ними.';
  return {
    heroId: hero.id, patch: source.patch, checkedAt: source.capturedAt, role: roleNames[role], title: editorial[0],
    summary: editorial[1].split('. ')[0] + '.', source: source.url, sourceLabel: 'Сборка на Dota2ProTracker',
    sample: `Проверено 31.10.2026. ${source.window.replace('Uses matches from ', 'Матчи: ').replace(' (14 days). Updated 31 окт..', ' 2026 (14 дней).')} Сборка: ${sampleText(buildSample)}. Выбрана основная позиция и первый, самый массовый вариант сборки. Популярность не гарантирует результат; советы по игре написаны отдельно.`,
    skillOrder, skillSample: `Частая последовательность: ${sampleText(skillSample)}. На линии порядок можно менять под соперника.`,
    talentChoices, talentPickRates, ...(Object.keys(talentLabels).length ? {talentLabels} : {}), itemGroups: groups,
    chapters: editorial.slice(1).map((text, index) => ({title: chapterTitles[index], text})),
    replay: {label: 'Примеры матчей на Dotabuff',
      url: `https://www.dotabuff.com/heroes/${hero.englishName.toLowerCase().replaceAll("'", '').replaceAll(' ', '-')}/guides`,
      note: 'Сравнивай матчи своей позиции: соперников, порядок покупок и момент выхода в бой. Отдельный удачный матч не доказывает, что сборка подходит всегда.'}
  };
}

export async function compileGuides() {
  const [catalog, snapshot, guidance] = await Promise.all([
    readJson('public/assets/heroes/catalog.json'), readJson('data-sources/hero-builds-2026-10-31.json.gz'), readJson('src/data/item-guidance.json')
  ]);
  if (snapshot.heroes.length !== catalog.heroes.length || new Set(snapshot.heroes.map(h => h.name)).size !== catalog.heroes.length)
    throw new Error('Incomplete or duplicated hero source snapshot');
  return Promise.all(catalog.heroes.map(async hero => {
    const card = await readJson(`public/assets/heroes/details/${hero.id}.json`);
    const source = snapshot.heroes.find(h => h.name === hero.englishName);
    return buildGuide(card, source, guidance.advice);
  }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const guides = await compileGuides();
  await mkdir(new URL('public/assets/heroes/guides/', root), {recursive: true});
  for (const guide of guides) await writeFile(new URL(`public/assets/heroes/guides/${guide.heroId}.json`, root), JSON.stringify(guide) + '\n');
  console.log(`Built ${guides.length} hero guides, patch ${guides[0].patch}.`);
}
