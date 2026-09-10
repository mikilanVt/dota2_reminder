import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {cleanItemText} from '../scripts/item-shop-data.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const json = path => JSON.parse(read(path));
const catalog = json('src/data/item-shop-catalog.json');
const layout = json('src/data/item-shop-layout.json');
const manifest = json('data-sources/item-shop-icons-2026-09-09.json');
const snapshot = JSON.parse(gunzipSync(read('data-sources/valve-item-shop-2026-09-10.json.gz')));
const items = catalog.groups.flatMap(group => group.items);
const detail = id => json(`public/assets/item-shop/details/${id}.json`);
const hash = content => createHash('sha256').update(content).digest('hex');

test('every shop tile has the correct local icon, source and description', () => {
  assert.equal(items.length, 250);
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  assert.equal(catalog.groups.find(group => group.id === 'enhancements').items.length, 19);
  assert.equal(snapshot.items.length, items.length);
  assert.equal(manifest.items.length, items.length);
  for (const group of catalog.groups) {
    assert.deepEqual(group.items.map(item => item.key), layout.find(entry => entry.id === group.id).items);
    for (const item of group.items) {
      const icon = manifest.items.find(entry => entry.id === item.id);
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
  for (const item of items) {
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
  assert.deepEqual(detail(16).stats, [{label: 'Все атрибуты', value: '1'}]);
  assert.match(detail(116).description, /\+60% к сопротивлению магии/);
  assert.match(detail(116).description, /Длительность: 9 \/ 8 \/ 7 сек\./);
  assert.match(detail(1858).description, /2,5% от их максимального здоровья/);
});

test('unknown source parameters remain visibly unresolved instead of becoming invented numbers', () => {
  assert.deepEqual(cleanItemText('<h1>Урон</h1>%missing_damage%', new Map()), {content: 'Урон\n\n…', unresolved: true});
  assert.deepEqual(cleanItemText('+%resistance%%% &amp; $all', new Map([['resistance', [60]]])), {content: '+60% & Все атрибуты', unresolved: false});
});
