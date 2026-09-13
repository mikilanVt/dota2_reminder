import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {starterItems} from '../.test-build/data/starter-items.js';
import {createSession, reduceSession, missedQuestionIds, validateBank} from '../.test-build/features/training/engine.js';

const cloneBank = () => structuredClone(starterItems);
const fixedRandom = () => 0.42;
const makeSession = options => createSession(starterItems, ['items'], {random: fixedRandom, ...options});
const detail = id => JSON.parse(readFileSync(new URL(`../public/assets/item-shop/details/${id}.json`, import.meta.url), 'utf8'));
const entity = id => starterItems.entities.find(entry => entry.id === id);

function answerCurrent(session, correct = true) {
  const question = session.questions[session.index];
  const option = question.options.find(entry => (entry.id === question.correctOptionId) === correct);
  return reduceSession(reduceSession(session, {type: 'select', optionId: option.id}), {type: 'check'});
}

test('starter item values match the saved Valve numeric snapshot', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../data-sources/valve-items-2026-09-09.json', import.meta.url), 'utf8'));
  validateBank(starterItems);
  assert.equal(starterItems.entities.length, 12);
  assert.equal(starterItems.questions.length, 36);
  assert.equal(starterItems.facts.length, starterItems.questions.length);
  let matched = 0;
  for (const entry of starterItems.entities) {
    const source = snapshot.items.find(candidate => candidate.item.id === entry.valveId);
    if (!source) continue;
    matched += 1;
    assert.equal(entry.source.url, source.source_url);
    assert.equal(entry.verification.patch, snapshot.patch_context);
    for (const [key, value] of Object.entries(entry.values)) {
      assert.equal(value, source.item.special_values.find(field => field.name === key)?.values_float[0], `${entry.name}.${key}`);
    }
  }
  assert.equal(matched, 7, 'The original seven-item raw Valve snapshot must stay covered.');
});

test('expanded training values match the imported Valve item cards', () => {
  const stick = detail(34);
  const stickEntity = entity('item_magic_stick');
  const stickValues = stick.description.match(/восстанавливает (\d+) здоровья и маны[\s\S]*?до (\d+) зарядов[\s\S]*?радиусе (\d+)/);
  assert.ok(stickValues);
  assert.equal(stickEntity.values.restore_per_charge, Number(stickValues[1]));
  assert.equal(stickEntity.values.max_charges, Number(stickValues[2]));
  assert.equal(stickEntity.values.charge_radius, Number(stickValues[3]));
  assert.equal(stickEntity.values.cooldown, stick.abilities[0].cooldown[0]);

  const wand = detail(36);
  const wandEntity = entity('item_magic_wand');
  const wandValues = wand.description.match(/восстанавливает (\d+) здоровья и маны[\s\S]*?до (\d+) зарядов[\s\S]*?радиусе (\d+)/);
  assert.ok(wandValues);
  assert.equal(wandEntity.values.restore_per_charge, Number(wandValues[1]));
  assert.equal(wandEntity.values.max_charges, Number(wandValues[2]));
  assert.equal(wandEntity.values.charge_radius, Number(wandValues[3]));
  assert.equal(wandEntity.values.bonus_all_stats, Number(wand.stats.find(stat => stat.label === 'ко всем атрибутам').value));
  assert.equal(wandEntity.values.cooldown, wand.abilities[0].cooldown[0]);

  const treads = detail(63);
  const treadsEntity = entity('item_power_treads');
  const treadsStats = new Map(treads.stats.map(stat => [stat.label, Number(stat.value)]));
  assert.equal(treadsEntity.values.bonus_attribute, treadsStats.get('к выбранному атрибуту'));
  assert.equal(treadsEntity.values.attack_speed, treadsStats.get('к скорости атаки'));
  assert.equal(treadsEntity.values.ranged_move_speed, treadsStats.get('к скорости передвижения (дальний бой)'));
  assert.equal(treadsEntity.values.melee_move_speed, treadsStats.get('к скорости передвижения (ближний бой)'));

  const blink = detail(1);
  const blinkEntity = entity('item_blink');
  const lockout = blink.description.match(/последние (\d+) сек/);
  assert.ok(lockout);
  assert.equal(blinkEntity.values.blink_range, blink.abilities[0].range[0]);
  assert.equal(blinkEntity.values.damage_lockout, Number(lockout[1]));
  assert.equal(blinkEntity.values.cooldown, blink.abilities[0].cooldown[0]);

  const bkb = detail(116);
  const bkbEntity = entity('item_black_king_bar');
  const resistance = bkb.description.match(/\+(\d+)% к сопротивлению магии/);
  const durations = bkb.description.match(/Длительность: (\d+) \/ (\d+) \/ (\d+) сек/);
  const bkbStats = new Map(bkb.stats.map(stat => [stat.label, Number(stat.value)]));
  assert.ok(resistance);
  assert.ok(durations);
  assert.equal(bkbEntity.values.magic_resistance, Number(resistance[1]));
  assert.equal(bkbEntity.values.first_duration, Number(durations[1]));
  assert.equal(bkbEntity.values.minimum_duration, Number(durations[3]));
  assert.equal(bkbEntity.values.mana_cost, bkb.abilities[0].mana[0]);
  assert.equal(bkbEntity.values.cooldown, bkb.abilities[0].cooldown[0]);
  assert.equal(bkbEntity.values.bonus_strength, bkbStats.get('к силе'));
  assert.equal(bkbEntity.values.bonus_damage, bkbStats.get('к урону'));

  for (const entry of [stick, wand, treads, blink, bkb]) {
    assert.equal(entry.patchContext, starterItems.patch);
    assert.ok(entry.source.startsWith('https://www.dota2.com/datafeed/itemdata'));
  }
});

test('a round contains ten distinct questions and four distinct shuffled answers', () => {
  const before = JSON.stringify(starterItems);
  const session = makeSession();
  assert.equal(session.questions.length, 10);
  assert.equal(new Set(session.questions.map(question => question.id)).size, 10);
  for (const question of session.questions) {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(option => option.value)).size, 4);
    const correct = question.options.find(option => option.id === question.correctOptionId);
    assert.equal(correct.value, question.fact.value);
    assert.ok(question.fact.source.url.startsWith('https://www.dota2.com/'));
  }
  assert.equal(JSON.stringify(starterItems), before, 'A session must not mutate the source data.');
  assert.notDeepEqual(makeSession({random: () => 0}).questions.map(q => q.id), makeSession({random: () => 0.99}).questions.map(q => q.id));
});

test('unverified data, different patches and unavailable topics are excluded', () => {
  const bank = cloneBank();
  const unverified = bank.facts[0];
  const outdated = bank.facts[1];
  unverified.verification = {...unverified.verification, status: 'needs-review'};
  outdated.verification = {...outdated.verification, patch: '7.40'};
  const session = createSession(bank, ['items'], {limit: 100, random: fixedRandom});
  assert.equal(session.questions.length, starterItems.questions.length - 2);
  assert.ok(session.questions.every(q => ![unverified.id, outdated.id].includes(q.fact.id)));
  const empty = createSession(bank, ['heroes', 'map']);
  assert.equal(empty.questions.length, 0);
  assert.equal(empty.phase, 'finished');
  assert.strictEqual(reduceSession(empty, {type: 'next'}), empty);
});

test('answer checking cannot be skipped, counted twice or changed after checking', () => {
  const start = makeSession({limit: 1});
  assert.strictEqual(reduceSession(start, {type: 'check'}), start);
  assert.strictEqual(reduceSession(start, {type: 'next'}), start);
  assert.strictEqual(reduceSession(start, {type: 'select', optionId: 'unknown'}), start);
  const checked = answerCurrent(start);
  assert.equal(checked.answers.length, 1);
  assert.equal(checked.answers[0].correct, true);
  assert.equal(checked.phase, 'reviewing');
  assert.strictEqual(reduceSession(checked, {type: 'check'}), checked);
  assert.strictEqual(reduceSession(checked, {type: 'select', optionId: start.questions[0].options[0].id}), checked);
  const finished = reduceSession(checked, {type: 'next'});
  assert.equal(finished.phase, 'finished');
  assert.strictEqual(reduceSession(finished, {type: 'next'}), finished);
});

test('the full round scores answers and a retry includes only mistakes with a fresh score', () => {
  let session = makeSession();
  const expectedMistakes = session.questions.filter((_, index) => index % 2).map(q => q.id);
  while (session.phase !== 'finished') {
    session = answerCurrent(session, session.index % 2 === 0);
    session = reduceSession(session, {type: 'next'});
    if (session.phase === 'answering') assert.equal(session.selectedOptionId, null);
  }
  assert.equal(session.answers.length, 10);
  assert.equal(session.answers.filter(answer => answer.correct).length, 5);
  assert.deepEqual(missedQuestionIds(session), expectedMistakes);
  let retry = makeSession({questionIds: missedQuestionIds(session)});
  assert.equal(retry.answers.length, 0);
  assert.deepEqual(new Set(retry.questions.map(q => q.id)), new Set(expectedMistakes));
  while (retry.phase !== 'finished') retry = reduceSession(answerCurrent(retry), {type: 'next'});
  assert.deepEqual(missedQuestionIds(retry), []);
  assert.equal(retry.answers.length, expectedMistakes.length);
});

test('invalid banks are rejected before a round can start', () => {
  const duplicate = cloneBank();
  duplicate.questions.push(duplicate.questions[0]);
  assert.throws(() => validateBank(duplicate), /Duplicate/);
  const ambiguous = cloneBank();
  ambiguous.questions[0].distractors[0] = ambiguous.facts[0].value;
  assert.throws(() => validateBank(ambiguous), /Invalid answer/);
  const orphan = cloneBank();
  orphan.questions[0].factId = 'missing';
  assert.throws(() => validateBank(orphan), /Unknown fact/);
  assert.throws(() => makeSession({limit: 0}), /Invalid question limit/);
});
