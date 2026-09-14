import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {itemBank} from '../.test-build/data/item-bank.js';
import {starterItems} from '../.test-build/data/starter-items.js';
import {createSession, formatValue, reduceSession, validateBank} from '../.test-build/features/training/engine.js';
import {parseProgress, restoreRound, saveRound, emptyProgress, recordRound} from '../.test-build/features/progress/model.js';

const root = new URL('../', import.meta.url);
const generated = JSON.parse(readFileSync(new URL('src/data/item-quiz.generated.json', root)));
const snapshot = JSON.parse(gunzipSync(readFileSync(new URL('data-sources/valve-item-shop-2026-09-10.json.gz', root))));
const raw = new Map(snapshot.items.map(record => [record.id, JSON.parse(record.raw).result.data.items[0]]));
const fact = id => itemBank.facts.find(fact => fact.id === id);
const pack = session => saveRound(session, {id: 'quiz-test', bankId: itemBank.id, patch: itemBank.patch,
  topics: ['items'], kind: 'test', startedAt: '2026-09-14T00:00:00.000Z'}, '2026-09-14T00:00:01.000Z');
function random(seed) {return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);}

test('large bank is reproducible, covers all ten allowed topics and has a local WebP for every question', () => {
  execFileSync(process.execPath, ['scripts/build-item-quiz.mjs', '--check'], {cwd: root, stdio: 'pipe'});
  validateBank(itemBank);
  assert.ok(itemBank.questions.length >= 1000);
  assert.equal(itemBank.questions.filter(q => q.category === 'recognition').length, generated.items.length);
  assert.equal(new Set(itemBank.questions.map(q => q.category)).size, 10);
  assert.equal(new Set(generated.items.map(item => item.name)).size, generated.items.length);
  for (const entity of itemBank.entities) {
    assert.match(entity.image, /^assets\/item-shop\/icons\/[a-z0-9_]+\.webp$/);
    const bytes = readFileSync(new URL(`public/${entity.image}`, root));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  for (const question of itemBank.questions) assert.ok(itemBank.entities.find(e => e.id === fact(question.factId).entityId)?.image);
});

test('numerical answers are traceable to the exact Valve field, including zero mana, signs and contextual array entries', () => {
  for (const item of generated.items) for (const row of item.rows) {
    const source = raw.get(item.id);
    const saved = fact(`item_${item.key}.quiz.${row.key}`);
    assert.equal(saved.value, row.value);
    if (row.kind === 'price') assert.equal(row.value, source.item_cost);
    if (row.kind === 'mana') assert.equal(row.value, source.mana_costs[0]);
    if (row.kind === 'cooldown') {assert.equal(row.value, source.cooldowns[0]); assert.ok(row.value > 0);}
    if (row.kind === 'stats') assert.deepEqual(source.special_values.find(s => s.name === row.key).values_float, [row.value]);
    const match = row.evidence?.match(/^(special_values\.)?([a-zA-Z_0-9]+)\[(\d+)\](:magnitude)?$/);
    if (match) {
      const values = match[1] ? source.special_values.find(s => s.name === match[2]).values_float : source[match[2]];
      assert.equal(row.value, match[4] ? Math.abs(values[Number(match[3])]) : values[Number(match[3])]);
    }
  }
  assert.equal(fact('item_mjollnir.quiz.mana').value, 50);
  assert.equal(fact('item_mjollnir.quiz.cooldown').value, 35);
  assert.equal(fact('item_mjollnir.quiz.static_damage').value, 225);
  assert.equal(fact('item_mjollnir.quiz.chain_damage').value, 180);
  assert.equal(fact('item_blink.quiz.mana').value, 0);
  assert.equal(fact('item_holy_locket.quiz.use_cooldown').value, 13);
  assert.equal(fact('item_black_king_bar.quiz.duration-0').value, 9);
  assert.equal(fact('item_black_king_bar.quiz.duration-2').value, 7);
  assert.equal(fact('item_desolator.quiz.corruption_armor').value, 6);
});

test('no shop classification, casting type, radius, usefulness or ability-name questions enter the bank', () => {
  for (const question of itemBank.questions) {
    assert.doesNotMatch(question.prompt, /радиус|дальност|расстояни|категори|какому типу|какой тип предмета|когда полез|потайная лавка|расходник|вооружени|как называется способност/i);
    assert.doesNotMatch(fact(question.factId).evidence.join(' '), /cast_ranges|behavior|target_team|target_type|item_quality|item_stock|\.group|\.column/);
    const entity = itemBank.entities.find(entity => entity.id === fact(question.factId).entityId);
    assert.doesNotMatch(entity.id, /recipe_|enhancement_|ultimate_scepter_roshan|aghanims_shard_roshan|black_grimoire|royale_with_cheese|dagon_[2-5]/);
    if (question.category === 'recognition') {
      assert.ok(!question.prompt.includes(entity.name));
      assert.ok(!fact(question.factId).conditions.includes(entity.name));
    }
  }
});

test('neutral tiers and unlock times are checked together, and cannot be confused with a guaranteed drop', () => {
  const times = [0, 15, 25, 35, 60];
  const questions = itemBank.questions.filter(q => q.category === 'tier');
  assert.equal(questions.length, 49);
  for (const question of questions) {
    const tier = fact(question.factId);
    const timing = fact(tier.id.replace(/\.tier$/, '.timing'));
    assert.equal(timing.value, times[tier.value - 1]);
    assert.match(timing.conditions, /не гарантированное выпадение/);
    assert.match(timing.source.url, /dota2.com\/patches/);
  }
});

test('rounds have ten different items, span the allowed topics, and all displayed options are distinct', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const session = createSession(itemBank, ['items'], {random: random(seed)});
    assert.equal(session.questions.length, 10);
    assert.equal(new Set(session.questions.map(q => q.fact.entityId)).size, 10);
    assert.equal(new Set(session.questions.map(q => itemBank.questions.find(source => source.id === q.id).category)).size, 10);
    assert.equal(session.questions.filter(q => q.recognition).length, 1);
    for (const q of session.questions) {
      assert.ok(q.options.length >= 2 && q.options.length <= 4);
      assert.equal(new Set(q.options.map(o => o.label)).size, q.options.length);
      assert.equal(q.options.find(o => o.id === q.correctOptionId).label, formatValue(q.fact));
    }
  }
});

test('original unfinished tests and scores survive the additive bank expansion', () => {
  let session = createSession(starterItems, ['items'], {random: random(42)});
  session = reduceSession(session, {type: 'select', optionId: session.questions[0].correctOptionId});
  session = reduceSession(session, {type: 'check'});
  const saved = pack(session);
  const restored = restoreRound(saved, itemBank);
  assert.ok(restored);
  assert.deepEqual(pack(restored), saved);
  for (const original of starterItems.facts) assert.deepEqual(fact(original.id), original);
  for (const original of starterItems.questions) assert.deepEqual(itemBank.questions.find(q => q.id === original.id).distractors, original.distractors);
});

test('text, numeric and recognition answers survive export, reload, scoring and mistake retry', () => {
  const ids = ['q.1.recognition', 'q.174.illusions', 'q.158.dispel', 'q.158.mana'];
  let session = createSession(itemBank, ['items'], {questionIds: ids, random: random(8)});
  const missed = [];
  while (session.phase !== 'finished') {
    const question = session.questions[session.index];
    const chosen = session.index % 2 ? question.options.find(o => o.id !== question.correctOptionId).id : question.correctOptionId;
    if (chosen !== question.correctOptionId) missed.push(question.id);
    session = reduceSession(session, {type: 'select', optionId: chosen});
    let saved = pack(session);
    assert.deepEqual(pack(restoreRound(saved, itemBank)), saved);
    session = reduceSession(session, {type: 'check'});
    saved = pack(session);
    assert.deepEqual(pack(restoreRound(saved, itemBank)), saved);
    session = reduceSession(session, {type: 'next'});
  }
  const data = parseProgress(JSON.stringify(recordRound(emptyProgress(), pack(session))));
  const restored = restoreRound(data.history[0], itemBank);
  assert.equal(restored.answers.filter(a => a.correct).length, 2);
  const retry = createSession(itemBank, ['items'], {questionIds: missed});
  assert.deepEqual(new Set(retry.questions.map(q => q.id)), new Set(missed));
  assert.equal(retry.answers.length, 0);
});
