import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {acquisitionFor, adviceFor, guidance, itemByKey} from '../.test-build/features/items/guidance.js';

const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));
const catalog = json('src/data/item-shop-catalog.json');
const evidence = json('data-sources/item-guidance-2026-09-11.json');

test('editorial advice is patch-bound, has valid positions and points to the matching item source', () => {
  assert.equal(guidance.patch, catalog.patch);
  assert.equal(evidence.patchContext, guidance.patch);
  assert.equal(evidence.patchList.latest, guidance.patch);
  assert.equal(Object.keys(guidance.advice).length, 53);
  for (const [key, advice] of Object.entries(guidance.advice)) {
    const item = itemByKey.get(key);
    assert.ok(item, key);
    const positions = advice.roles.flatMap(role => role.positions);
    assert.equal(new Set(positions).size, positions.length, key);
    assert.ok(positions.length > 0 && positions.every(position => [1, 2, 3, 4, 5].includes(position)), key);
    assert.ok(advice.roles.every(role => role.reason.length > 25), key);
    assert.ok(advice.purpose && advice.caution, key);
    assert.equal(new URL(guidance.sources[advice.sources[0]].url).searchParams.get('item_id'), String(item.id));
    assert.equal(adviceFor(item, 'different-patch'), undefined);
    assert.ok(!acquisitionFor(item).unavailable, key);
  }
});

test('shop locations distinguish direct purchases, secret components and special acquisition', () => {
  const acquisition = key => acquisitionFor(itemByKey.get(key));
  assert.match(acquisition('blink').text, /лавке на базе/);
  assert.match(acquisition('hyperstone').text, /потайной лавке/);
  assert.match(acquisition('mjollnir').note, /потайной лавке/);
  assert.doesNotMatch(acquisition('magic_wand').note, /потайной/);
  assert.match(acquisition('ultimate_scepter_2').text, /компонентов/);
  assert.match(acquisition('great_famango').text, /35:00/);
  assert.match(acquisition('greater_famango').text, /60:00/);
  assert.match(acquisition('ward_dispenser').text, /объединяются/);
  for (const group of catalog.groups) for (const item of group.items) {
    const data = acquisitionFor(item);
    assert.ok(data.text.length > 10, item.key);
    assert.doesNotMatch(data.text, /\{\w+\}/, item.key);
    for (const key of data.related ?? []) assert.ok(itemByKey.has(key), `${item.key} -> ${key}`);
    for (const id of data.sources) assert.ok(guidance.sources[id]?.url.startsWith('https://'), id);
    if (group.id === 'special' || group.id === 'enhancements') assert.ok(guidance.acquisition[item.key], item.key);
  }
});

test('neutral times and attribute-based enchantments use the reviewed Valve patch', () => {
  for (const group of catalog.groups.filter(group => group.tier)) {
    for (const item of group.items) assert.ok(acquisitionFor(item).text.includes(group.unlockTime));
  }
  const patch = evidence.evidence.find(source => source.id === 'patch-7.41');
  const sourceText = JSON.stringify(patch.neutralSystem);
  assert.match(sourceText, /с 5:00 на 0:00/);
  assert.match(sourceText, /Ассортимент чар больше не выбирается случайным образом/);
  const normalizeName = name => name.toLowerCase().replace(/[^a-z]/g, '');
  for (const item of catalog.groups.find(group => group.id === 'enhancements').items) {
    assert.ok(normalizeName(sourceText).includes(normalizeName(item.englishName)), item.key);
    assert.deepEqual(guidance.acquisition[item.key].sources, ['patch-7.41']);
  }
  assert.match(guidance.acquisition.enhancement_brawny.text, /силы и ловкости/);
  assert.match(guidance.acquisition.enhancement_mystical.text, /интеллекта и универсальные/);
  assert.match(guidance.acquisition.enhancement_greedy.text, /2-й и 3-й/);
  assert.match(guidance.acquisition.enhancement_feverish.text, /5-й.*интеллекта/);
});

test('retired rewards and unverified acquisition are not presented as available shop purchases', () => {
  for (const key of ['ultimate_scepter_roshan', 'aghanims_shard_roshan', 'black_grimoire']) {
    assert.equal(acquisitionFor(itemByKey.get(key)).unavailable, true);
    assert.equal(adviceFor(itemByKey.get(key)), undefined);
  }
  assert.match(JSON.stringify(evidence.evidence.find(source => source.id === 'patch-7.38').generalNotes), /больше не роняет Aghanim's Blessing/);
  assert.match(JSON.stringify(evidence.evidence.find(source => source.id === 'patch-7.33').generalNotes), /больше не роняет Aghanim's Shard/);
  const shard = evidence.evidence.find(source => source.id === 'patch-7.31').shard;
  assert.match(JSON.stringify(shard), /после 15:00/);
  const cheese = guidance.acquisition.royale_with_cheese;
  assert.equal(cheese.verification, 'needs-review');
  assert.match(cheese.text, /не подтверждён/);
  assert.equal(itemByKey.get('royale_with_cheese').recipe, undefined);
});
