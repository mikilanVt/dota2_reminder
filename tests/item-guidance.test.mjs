import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {adviceFor, guidance, itemByKey} from '../.test-build/features/items/guidance.js';

const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));
const catalog = json('src/data/item-shop-catalog.json');
const evidence = json('data-sources/item-advice-2026-09-13.json');
const previousEvidence = json('data-sources/item-guidance-2026-09-11.json');
const visibleItems = catalog.groups.flatMap(group => group.items);

test('every catalog item has patch-bound advice with matching provenance and valid position examples', () => {
  assert.equal(guidance.patch, catalog.patch);
  assert.equal(evidence.patch, guidance.patch);
  assert.deepEqual(new Set(Object.keys(guidance.advice)), new Set(visibleItems.map(item => item.key)));
  for (const item of visibleItems) {
    const advice = adviceFor(item);
    assert.ok(advice, item.key);
    assert.ok(advice.purpose.length > 25 && advice.caution.length > 25, item.key);
    assert.ok(advice.roles.length || advice.tips.length, item.key);
    assert.ok(advice.tips.every(tip => tip.length > 25), item.key);
    assert.ok(advice.roles.every(role => role.reason.length > 25 && role.positions.length > 0), item.key);
    const positions = advice.roles.flatMap(role => role.positions);
    assert.equal(new Set(positions).size, positions.length, item.key);
    assert.ok(positions.every(position => [1, 2, 3, 4, 5].includes(position)), item.key);
    const refs = evidence.items[item.key].sources;
    assert.equal(new URL(evidence.sources[refs[0]].url).searchParams.get('item_id'), String(item.id));
    for (const id of refs) assert.ok(evidence.sources[id]?.url.startsWith('https://'), id);
    assert.equal(adviceFor(item, 'different-patch'), undefined);
  }
  assert.equal(adviceFor({...visibleItems[0], key: 'missing-item'}), undefined);
});

test('comparison links resolve to real distinct items and preserve a bounded choice', () => {
  for (const [key, advice] of Object.entries(guidance.advice)) {
    const links = advice.alternatives ?? [];
    assert.equal(links.length, new Set(links).size, key);
    assert.ok(links.length <= 3, key);
    for (const related of links) {
      assert.notEqual(related, key);
      assert.ok(itemByKey.has(related), `${key} -> ${related}`);
      assert.ok(adviceFor(itemByKey.get(related)), related);
    }
  }
});

test('hero examples match the recorded ProTracker sample without treating rates as universal recommendations', () => {
  const research = evidence.community;
  assert.equal(research.dptScope.windowDays, 8);
  assert.equal(research.dptScope.purchaseBeforeMatchEndMinutes, 7);
  assert.equal(research.dptScope.patch, null);
  assert.equal(research.dotabuffScope.window, 'This Month');
  const examples = Object.keys(guidance.advice).filter(key => guidance.advice[key].heroes?.length);
  assert.deepEqual(new Set(examples), new Set(research.dptItems.map(row => row.key)));
  for (const row of research.dptItems) {
    assert.ok(row.matches > 0 && row.purchaseRate > 0 && row.purchaseRate <= 100, row.key);
    assert.ok(row.heroes.every(hero => hero.matches >= research.dptScope.heroMinimumMatches && hero.matches <= row.matches), row.key);
    assert.deepEqual(guidance.advice[row.key].heroes, row.heroes.map(hero => hero.name));
    assert.ok(evidence.items[row.key].sources.includes('dpt-items'));
  }
  for (const row of research.dotabuffObservations) {
    assert.ok(row.timesUsed > 0 && row.useRate >= 0 && row.useRate <= 100 && row.winRate >= 0 && row.winRate <= 100, row.key);
    assert.ok(evidence.items[row.key].sources.includes('dotabuff-items'));
  }
});

test('retired rewards and unknown effects remain explicit instead of receiving invented current builds', () => {
  for (const key of ['ultimate_scepter_roshan', 'aghanims_shard_roshan', 'black_grimoire']) {
    const advice = adviceFor(itemByKey.get(key));
    assert.match(advice.purpose, /Архивн/);
    assert.deepEqual(advice.roles, []);
    assert.equal(advice.heroes, undefined);
  }
  assert.match(JSON.stringify(previousEvidence.evidence.find(source => source.id === 'patch-7.38').generalNotes), /больше не роняет Aghanim's Blessing/);
  assert.match(JSON.stringify(previousEvidence.evidence.find(source => source.id === 'patch-7.33').generalNotes), /больше не роняет Aghanim's Shard/);
  assert.match(guidance.advice.royale_with_cheese.caution, /не раскрывает полный эффект/);
  assert.equal(itemByKey.get('royale_with_cheese').recipe, undefined);
});
