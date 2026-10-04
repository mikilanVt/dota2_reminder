import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {abilityDescription, heroDescription, talentText} from '../scripts/hero-display-data.mjs';
import {parseHeroList, parseHeroResponse} from '../scripts/hero-source-data.mjs';

const root = new URL('../', import.meta.url);
const sourceFiles = (await readdir(new URL('data-sources/', root))).filter(file => /^valve-heroes-.*\.json\.gz$/.test(file)).sort();
const snapshot = JSON.parse(gunzipSync(await readFile(new URL('data-sources/' + sourceFiles.at(-1), root))));
const list = parseHeroList(snapshot.list.raw);
const heroes = snapshot.heroes.map(entry => parseHeroResponse(entry.raw, list.find(hero => hero.id === entry.id)));
const juggernaut = heroes.find(hero => hero.id === 8);

test('complete Valve snapshot validates every hero and matches the shipped catalog', async () => {
  const catalog = JSON.parse(await readFile(new URL('public/assets/heroes/catalog.json', root)));
  assert.equal(catalog.patch, snapshot.patchContext);
  assert.equal(catalog.heroes.length, list.length);
  assert.equal(new Set(catalog.heroes.map(hero => hero.id)).size, list.length);
  for (const hero of heroes) {
    const card = JSON.parse(await readFile(new URL(`public/assets/heroes/details/${hero.id}.json`, root)));
    assert.equal(card.key, hero.name.slice(14));
    assert.equal(card.patch, snapshot.patchContext);
    assert.equal(card.abilities.length, hero.abilities.length);
    for (const ability of card.abilities) {
      assert.doesNotMatch(ability.description, /<[^>]+>|%[a-z_]+%/i);
      for (const value of [...ability.mana, ...ability.cooldown, ...ability.range]) assert.ok(Number.isFinite(value));
    }
  }
});

test('damage is not double-counted, and universal damage uses Valve display rule', () => {
  const card = heroDescription(juggernaut, {});
  assert.deepEqual(card.stats.damage, [juggernaut.damage_min, juggernaut.damage_max]);
  const hero = {...juggernaut, primary_attr: 3, str_base: 20, agi_base: 30, int_base: 10, damage_min: 5, damage_max: 7};
  assert.deepEqual(heroDescription(hero, {}).stats.damage, [32, 34]);
});

test('upgrade text resolves bonus tokens without changing base values or showing stale unflagged upgrades', () => {
  const bane = heroes.find(hero => hero.id === 3);
  const brainSap = bane.abilities.find(ability => ability.name === 'bane_brain_sap');
  const card = abilityDescription(brainSap);
  assert.deepEqual(card.cooldown, brainSap.cooldowns);
  assert.equal(card.upgrades[0].unresolved, false);
  assert.match(card.upgrades[0].text, /3 сек/);
  const stale = {...juggernaut.abilities[0], ability_has_scepter: false, scepter_loc: 'Stale upgrade'};
  assert.equal(abilityDescription(stale).upgrades.some(upgrade => upgrade.kind === 'scepter'), false);
});

test('talent values come from the matching bonus; ambiguous or absent values stay unresolved', () => {
  const talent = juggernaut.talents.find(talent => talent.name === 'special_bonus_unique_juggernaut_3');
  assert.match(talentText(talent, juggernaut.abilities).text, /1 сек/);
  assert.equal(talentText(talent, []).unresolved, true);
});

test('guide references existing abilities, talents and local item images', async () => {
  const guide = JSON.parse(await readFile(new URL('public/assets/heroes/guides/8.json', root)));
  assert.equal(guide.patch, snapshot.patchContext);
  assert.equal(guide.skillOrder.length, 10);
  for (const key of guide.skillOrder) assert.ok(juggernaut.abilities.some(ability => ability.name === key));
  for (const key of guide.talentChoices) assert.ok(juggernaut.talents.some(talent => talent.name === key));
  for (const item of guide.itemGroups.flatMap(group => group.items))
    assert.ok((await readFile(new URL(`public/assets/item-shop/icons/${item.key}.webp`, root))).byteLength > 0);
});
