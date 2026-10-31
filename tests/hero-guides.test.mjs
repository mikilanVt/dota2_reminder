import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {compileGuides, buildGuide, itemKey} from '../scripts/build-hero-guides.mjs';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root)));
const catalog = await readJson('public/assets/heroes/catalog.json');
const snapshot = JSON.parse(gunzipSync(await readFile(new URL('data-sources/hero-builds-2026-10-31.json.gz', root))));
const advice = (await readJson('src/data/item-guidance.json')).advice;
const generated = await compileGuides();

test('every hero has a reproducible, dated guide with individual editorial notes', async () => {
  assert.equal(generated.length, catalog.heroes.length);
  assert.equal((await readdir(new URL('public/assets/heroes/guides/', root))).filter(p => p.endsWith('.json')).length, catalog.heroes.length);
  const paragraphs = [];
  for (const guide of generated) {
    assert.deepEqual(await readJson(`public/assets/heroes/guides/${guide.heroId}.json`), guide);
    assert.equal(guide.patch, catalog.patch);
    assert.equal(guide.checkedAt, snapshot.capturedAt);
    assert.match(guide.source, /^https:\/\/dota2protracker\.com\/hero\/legacy\//);
    assert.match(guide.replay.url, /^https:\/\/www\.dotabuff\.com\/heroes\/[a-z-]+\/guides$/);
    assert.equal(guide.chapters.length, 4);
    for (const chapter of guide.chapters) {assert.ok(chapter.text.trim()); assert.doesNotMatch(chapter.text, /заглушка|ещё готовится/); paragraphs.push(chapter.text);}
  }
  assert.equal(new Set(paragraphs).size, paragraphs.length, 'No repeated placeholder chapters');
});

test('all guide skills, talents and item icons belong to the selected hero and catalog', async () => {
  for (const guide of generated) {
    const hero = await readJson(`public/assets/heroes/details/${guide.heroId}.json`);
    assert.equal(guide.skillOrder.length, 10);
    guide.skillOrder.forEach((key, index) => {
      const talent = hero.talents.find(t => t.key === key);
      assert.ok(hero.abilities.some(a => a.key === key) || key === 'attribute_bonus' || talent, `${hero.key}: ${key}`);
      if (talent) assert.ok(talent.level <= index + 1);
    });
    assert.deepEqual(guide.talentChoices.map(key => hero.talents.find(t => t.key === key)?.level), [10, 15, 20, 25]);
    for (const key of guide.talentChoices) assert.ok(guide.talentPickRates[key] >= 50 && guide.talentPickRates[key] <= 100);
    for (const group of guide.itemGroups) {
      assert.equal(new Set(group.items.map(i => i.key)).size, group.items.length, 'No duplicate item buttons');
      for (const item of group.items) {
        assert.ok((await stat(new URL(`public/assets/item-shop/icons/${item.icon ?? item.key}.webp`, root))).size > 0, item.key);
        assert.ok(item.reason.trim());
        assert.doesNotMatch(item.reason, /undefined|<[^>]+>|%[a-z_]+%/);
      }
    }
  }
});

test('provider talent sides map to Valve talent pairs without swapping numeric bonuses', async () => {
  const numbers = text => [...text.replaceAll(',', '.').matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0])).sort((a, b) => a - b);
  // Equivalent localized wording, or an unresolved token on D2PT itself.
  // Pin the observed text so a future numeric change cannot silently pass.
  const knownLabelDifferences = new Map([
    ['kunkka:10:left', 'Tidebringer applies 60% slow for 60_durations'],
    ['monkey_king:25:left', "Additional Wukong's Command Ring"],
    ['monkey_king:15:right', '0 Cooldown Primal Spring'],
    ['leshrac:20:right', 'Diabolic Edict Hits An Additional Target'],
    ['brewmaster:10:left', '+2/2_extends Drunken Brawler Brew Up / Extend Duration'],
    ['batrider:20:right', 'Attacks apply 1 Stack of Sticky Napalm']
  ]);
  for (const source of snapshot.heroes) {
    const summary = catalog.heroes.find(h => h.englishName === source.name);
    const hero = await readJson(`public/assets/heroes/details/${summary.id}.json`);
    for (const row of source.talents) for (const choice of row.choices) {
      const talent = hero.talents.filter(t => t.level === row.level)[choice.side === 'left' ? 1 : 0];
      if (talent.unresolved) continue;
      const difference = knownLabelDifferences.get(`${hero.key}:${row.level}:${choice.side}`);
      if (difference) {assert.equal(choice.text.split('\n')[0], difference); continue;}
      assert.deepEqual(numbers(choice.text.split('\n')[0]), numbers(talent.text), `${hero.key}/${row.level}/${choice.side}`);
    }
  }
});

test('Juggernaut gets the current build, and consumable charges never become purchased sets', () => {
  const guide = generated.find(g => g.heroId === 8);
  assert.equal(guide.itemGroups[0].items.find(i => i.key === 'branches').quantity, 2);
  const tango = guide.itemGroups[0].items.find(i => i.key === 'tango');
  assert.equal(tango.charges, 3);
  assert.equal(tango.quantity, undefined);
  assert.equal(guide.itemGroups[1].items.find(i => i.key === 'power_treads').timing, '≈ 6 мин');
  assert.equal(guide.itemGroups[1].items.find(i => i.key === 'blink').timing, '≈ 28 мин');
  assert.match(guide.skillSample, /2\s552 матча/);
  assert.ok(guide.itemGroups[2].items.some(i => i.key === 'black_king_bar'));
  assert.equal(itemKey('parasma'), 'devastator');
  assert.equal(itemKey('khanda'), 'angels_demise');
});

test('level ten talent is retained as a step; corrupted sources cannot silently ship', async () => {
  const gyro = await readJson('public/assets/heroes/details/72.json');
  const source = snapshot.heroes.find(h => h.name === 'Gyrocopter');
  const guide = buildGuide(gyro, source, advice);
  assert.ok(gyro.talents.some(t => t.key === guide.skillOrder[9] && t.level === 10));
  assert.throws(() => buildGuide(gyro, {...source, patch: 'old'}, advice), /Wrong source/);
  assert.throws(() => buildGuide(gyro, {...source, skills: source.skills.slice(1)}, advice), /Incomplete/);
  const badSkill = structuredClone(source);
  badSkill.skills[0].key = 'foreign_ability';
  assert.throws(() => buildGuide(gyro, badSkill, advice), /Unknown skill/);
  const badTalent = structuredClone(source);
  badTalent.talents[0].choices[0].text = 'Unknown pick rate';
  assert.throws(() => buildGuide(gyro, badTalent, advice), /Invalid talents/);
});
