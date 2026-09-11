import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {cleanItemText, itemProperties} from '../scripts/item-shop-data.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const json = path => JSON.parse(read(path));
const catalog = json('src/data/item-shop-catalog.json');
const layout = json('src/data/item-shop-layout.json');
const manifest = json('data-sources/item-shop-icons-2026-09-09.json');
const extraIcons = json('data-sources/item-shop-extra-icons-2026-09-10.json');
const icons = [...manifest.items, ...extraIcons.items];
const snapshot = JSON.parse(gunzipSync(read('data-sources/valve-item-shop-2026-09-10.json.gz')));
const items = catalog.groups.flatMap(group => group.items);
const allItems = [...items, ...catalog.extras];
const detail = id => json(`public/assets/item-shop/details/${id}.json`);
const hash = content => createHash('sha256').update(content).digest('hex');

test('every shop tile has the correct local icon, source and description', () => {
  assert.equal(items.length, 271);
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  assert.equal(catalog.groups.find(group => group.id === 'enhancements').items.length, 19);
  assert.equal(snapshot.items.length, allItems.length);
  for (const group of catalog.groups) {
    assert.deepEqual(group.items.map(item => item.key), layout.find(entry => entry.id === group.id).items);
    for (const item of group.items) {
      const icon = icons.find(entry => entry.id === item.id);
      assert.equal(icon.key, item.key);
      const buffer = read(`public/assets/item-shop/icons/${item.icon}`);
      assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
      assert.equal(hash(buffer), icon.webpSha256, item.key);
      const source = snapshot.items.find(entry => entry.id === item.id);
      assert.equal(hash(source.raw), source.sha256);
      const original = JSON.parse(source.raw).result.data.items[0];
      const data = detail(item.id);
      assert.equal(original.id, item.id);
      assert.equal(data.id, item.id);
      assert.equal(data.name, original.name_loc);
      assert.equal(data.cost, original.item_cost);
      assert.equal(data.source, source.source);
      assert.equal(data.retrievedAt, source.retrievedAt);
      assert.equal(data.patchContext, snapshot.patchContext);
      assert.equal(data.verification, 'imported');
    }
  }
});

test('all imported descriptions resolve Valve placeholders and localization codes', () => {
  for (const item of allItems) {
    const data = detail(item.id);
    assert.equal(data.unresolved, false, item.key);
    const text = [data.description, data.lore, ...data.notes, ...data.stats.flatMap(stat => [stat.label, stat.value])].join('\n');
    assert.doesNotMatch(text, /%[a-z_0-9]+%|\$[a-z_]+|%%|<\/?[a-z][^>]*>/i, item.key);
  }
});

test('teleport, attributes and percentage values retain their source meaning', () => {
  const teleport = detail(46);
  assert.equal(teleport.cost, 100);
  assert.deepEqual(teleport.mana, [75]);
  assert.deepEqual(teleport.cooldown, [80]);
  assert.deepEqual(teleport.channel, [3]);
  assert.match(teleport.description, /После 3 сек\./);
  assert.deepEqual(detail(16).stats, [{label: 'ко всем атрибутам', value: '1', sign: '+', penalty: false}]);
  assert.match(detail(116).description, /\+60% к сопротивлению магии/);
  assert.match(detail(116).description, /Длительность: 9 \/ 8 \/ 7 сек\./);
  assert.match(detail(1858).description, /2,5% от их максимального здоровья/);
});

test('tooltip properties and ability frames preserve active, passive and dispel semantics', () => {
  const mjollnir = detail(158);
  assert.deepEqual(mjollnir.properties, [
    {label: 'ТИП', value: 'направленная на существо'},
    {label: 'ДЕЙСТВУЕТ', value: 'на союзных существ'},
    {label: 'МОЖНО РАЗВЕЯТЬ', value: 'да'}
  ]);
  assert.deepEqual(mjollnir.abilities.map(ability => ability.kind), ['active', 'passive']);
  assert.deepEqual(mjollnir.abilities[0].range, [800]);
  assert.deepEqual(mjollnir.abilities[0].mana, [50]);
  assert.deepEqual(mjollnir.abilities[0].cooldown, [35]);
  assert.deepEqual(mjollnir.abilities[1].mana, []);
  assert.deepEqual(mjollnir.stats.map(stat => [stat.sign, stat.value, stat.label]), [['+', '25', 'к урону'], ['+', '90', 'к скорости атаки']]);
  const sample = {behavior: '2', target_team: 0, target_type: 0, damage: 0, immunity: 0, dispellable: 1};
  assert.equal(itemProperties(sample).at(-1).value, 'сильным развеиванием');
  assert.equal(itemProperties({...sample, dispellable: 3}).at(-1).value, 'нет');
  assert.equal(itemProperties({...sample, dispellable: 0}).length, 1);
});

test('recipe links resolve to real items, paid scrolls and the official component lists', () => {
  const list = JSON.parse(gunzipSync(read('data-sources/valve-item-list-2026-09-09.json.gz'))).result.data.itemabilities;
  const known = new Map(allItems.map(item => [item.id, item]));
  const byKey = key => items.find(item => item.key === key);
  assert.deepEqual(byKey('mjollnir').recipe.components, [166, 55]);
  assert.equal(byKey('mjollnir').recipe.scroll, 157);
  assert.deepEqual(byKey('travel_boots_2').recipe.components, [48, 47]);
  assert.equal(byKey('travel_boots_2').recipe.scroll, undefined);
  assert.equal(byKey('ultimate_scepter_2').recipe.scroll, 270);
  for (const item of items) {
    if (!item.recipe) continue;
    const original = list.find(entry => entry.name === `item_recipe_${item.key}`);
    assert.deepEqual(item.recipe.variants, original.recipes.map(recipe => recipe.items), item.key);
    for (const id of [...item.recipe.variants.flat(), ...(item.recipe.scroll ? [item.recipe.scroll] : [])]) {
      assert.ok(known.has(id), `Broken recipe ${item.key} -> ${id}`);
      assert.equal(detail(id).id, id);
      assert.ok(read(`public/assets/item-shop/icons/${known.get(id).icon}`).length);
    }
    if (item.recipe.scroll) assert.ok(detail(item.recipe.scroll).cost > 0, item.key);
  }
  for (const group of catalog.groups.filter(group => group.column === 'neutral'))
    assert.ok(group.items.every(item => !item.recipe), 'Neutral artifacts must not inherit obsolete shop recipes.');
});

test('all five neutral tiers have access times and unwanted Dagon variants are absent', () => {
  const times = json('data-sources/neutral-item-times-2026-09-10.json');
  assert.deepEqual(catalog.groups.filter(group => group.tier).map(group => group.unlockTime), times.times.map(minutes => `${minutes}:00`));
  assert.ok(items.some(item => item.key === 'ultimate_scepter_2'));
  assert.ok(items.some(item => item.key === 'travel_boots_2'));
  assert.ok(items.every(item => !/^dagon_[2-5]$/.test(item.key)));
});

test('unknown source parameters remain visibly unresolved instead of becoming invented numbers', () => {
  assert.deepEqual(cleanItemText('<h1>Урон</h1>%missing_damage%', new Map()), {content: 'Урон\n\n…', unresolved: true});
  assert.deepEqual(cleanItemText('+%resistance%%% &amp; $all', new Map([['resistance', [60]]])), {content: '+60% & Все атрибуты', unresolved: false});
});
