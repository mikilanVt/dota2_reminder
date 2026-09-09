import assert from 'node:assert/strict';
import test from 'node:test';
import {starterItems} from '../.test-build/data/starter-items.js';
import {createSession, reduceSession} from '../.test-build/features/training/engine.js';
import {correctCount, emptyProgress, MAX_FILE_BYTES, MAX_HISTORY, mergeProgress, mistakeIds, parseProgress, reconcileProgress, recordRound, restoreRound, saveRound} from '../.test-build/features/progress/model.js';
import {createProgressStore, STORAGE_KEY} from '../.test-build/features/progress/storage.js';

const now = '2026-09-09T12:00:00.000Z';
const metadata = {id: 'round-1', bankId: starterItems.id, patch: starterItems.patch, topics: ['items'], kind: 'test', startedAt: now};
const start = () => createSession(starterItems, ['items'], {random: () => .42});
const pack = (session, overrides = {}) => saveRound(session, {...metadata, ...overrides}, now);
const roundTrip = progress => parseProgress(JSON.stringify(progress));
function select(session, correct = true) {
  const question = session.questions[session.index];
  return reduceSession(session, {type: 'select', optionId: question.options.find(option => (option.id === question.correctOptionId) === correct).id});
}
function finish() {
  let session = start();
  while (session.phase !== 'finished') {
    session = reduceSession(select(session, session.index % 2 === 0), {type: 'check'});
    session = reduceSession(session, {type: 'next'});
  }
  return session;
}
function memoryStorage() {
  const values = new Map();
  return {values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
}

test('reload restores exact order, selected answer and feedback at every step of a full round', () => {
  let session = start();
  function reload() {
    const saved = pack(session);
    const data = roundTrip(recordRound(emptyProgress(), saved));
    const restored = restoreRound(data.draft ?? data.history[0], starterItems);
    assert.deepEqual(restored, session);
    session = restored;
  }
  reload();
  while (session.phase !== 'finished') {
    session = select(session, session.index % 2 === 0);
    reload();
    session = reduceSession(session, {type: 'check'});
    reload();
    assert.strictEqual(reduceSession(session, {type: 'check'}), session, 'A restored answer cannot be scored twice.');
    assert.strictEqual(select(session, false), session, 'A reviewed answer remains locked.');
    session = reduceSession(session, {type: 'next'});
    reload();
  }
  assert.equal(session.answers.filter(answer => answer.correct).length, 5);
});

test('mistake history survives export and produces only failed questions with a fresh score', () => {
  const saved = pack(finish());
  const imported = reconcileProgress(roundTrip(recordRound(emptyProgress(), saved)), starterItems);
  assert.equal(correctCount(imported.history[0]), 5);
  const ids = mistakeIds(imported.history[0]);
  const retry = createSession(starterItems, ['items'], {questionIds: ids});
  assert.deepEqual(new Set(retry.questions.map(question => question.id)), new Set(ids));
  assert.equal(retry.answers.length, 0);
  const retrySaved = pack(retry, {id: 'retry-1', kind: 'mistakes'});
  assert.equal(restoreRound(roundTrip({...imported, draft: retrySaved}).draft, starterItems).questions.length, 5);
});

test('completed sessions are recorded once and merge keeps a bounded recent history', () => {
  let data = emptyProgress();
  const session = finish();
  for (let index = 0; index < 80; index++) {
    const date = new Date(Date.parse(now) + index * 60_000).toISOString();
    const round = saveRound(session, {...metadata, id: `round-${index}`, startedAt: date}, date);
    data = recordRound(data, round);
    data = recordRound(data, round);
  }
  assert.equal(data.history.length, MAX_HISTORY);
  assert.equal(data.history[0].id, 'round-79');
  assert.equal(data.history.at(-1).id, 'round-30');
  assert.equal(data.draft, null);
  assert.ok(Buffer.byteLength(JSON.stringify(data)) < MAX_FILE_BYTES);
  assert.deepEqual(mergeProgress(data, roundTrip(data)), data);
  const longIds = data.history.map((round, index) => ({...round, id: `long-${index}`, questions: round.questions.map((question, q) => ({
    id: `${'q'.repeat(85)}-${q}`, optionIds: question.optionIds.map((_, option) => `${'o'.repeat(85)}-${q}-${option}`)
  })), answers: round.answers.map((answer, q) => ({...answer, optionId: `${'o'.repeat(85)}-${q}-0`})), selectedOptionId: `${'o'.repeat(85)}-9-0`}));
  const bounded = mergeProgress(emptyProgress(), {version: 1, history: longIds, draft: pack(start())});
  assert.ok(Buffer.byteLength(JSON.stringify(bounded)) <= MAX_FILE_BYTES);
  assert.doesNotThrow(() => roundTrip(bounded));
});

test('import preserves a local unfinished test and a matching completed record supersedes its draft', () => {
  const local = recordRound(emptyProgress(), pack(select(start())));
  const incoming = {version: 1, history: [pack(finish(), {id: 'finished-other'})], draft: pack(start(), {id: 'draft-other'})};
  const combined = mergeProgress(local, incoming);
  assert.deepEqual(combined.draft, local.draft);
  assert.equal(combined.history.length, 1);
  const completed = mergeProgress(combined, recordRound(emptyProgress(), pack(finish())));
  assert.equal(completed.draft, null);
  assert.equal(completed.history.length, 2);
});

test('new patch, changed bank, unavailable facts and unknown IDs cannot resume stale data', () => {
  const saved = pack(select(start()));
  assert.equal(restoreRound(saved, {...starterItems, patch: '7.42'}), null);
  assert.equal(restoreRound(saved, {...starterItems, id: 'new-question-revision'}), null);
  const unavailable = structuredClone(starterItems);
  const factId = unavailable.questions.find(question => question.id === saved.questions[0].id).factId;
  unavailable.facts.find(fact => fact.id === factId).verification.status = 'needs-review';
  assert.equal(restoreRound(saved, unavailable), null);
  const unknown = structuredClone(saved);
  unknown.questions[0].optionIds[0] = 'unknown';
  assert.equal(restoreRound(unknown, starterItems), null);
  const archived = recordRound(emptyProgress(), pack(finish()));
  assert.deepEqual(reconcileProgress(archived, {...starterItems, patch: '7.42'}), archived, 'Earlier results remain in history.');
});

test('imported scores are recalculated from current answers and arbitrary fields are discarded', () => {
  const data = recordRound(emptyProgress(), pack(finish()));
  const edited = JSON.parse(JSON.stringify(data));
  edited.history[0].answers.forEach(answer => {answer.correct = true;});
  edited.history[0].html = '<script>untrusted</script>';
  edited.unrelated = 'discard';
  const normalized = reconcileProgress(parseProgress(JSON.stringify(edited)), starterItems);
  assert.equal(correctCount(normalized.history[0]), 5);
  assert.equal('html' in normalized.history[0], false);
  assert.equal('unrelated' in normalized, false);
});

test('bad or oversized imports are rejected before an existing save can be replaced', () => {
  const storage = memoryStorage();
  const store = createProgressStore(storage);
  const original = recordRound(emptyProgress(), pack(select(start())));
  store.write(original);
  const malformed = [null, {}, {...original, version: 2}, {...original, history: Array(51).fill(pack(finish()))}];
  for (const mutate of [
    round => {round.questions.push(round.questions[0]);},
    round => {round.questions[0].optionIds[1] = round.questions[0].optionIds[0];},
    round => {round.answers = [{optionId: 'missing', correct: true}];},
    round => {round.phase = 'finished';},
    round => {round.topics = ['items', 'items'];},
    round => {round.updatedAt = 'invalid-date';},
    round => {round.kind = ['test'];},
    round => {round.selectedOptionId = 'not-an-option';}
  ]) {
    const corrupt = structuredClone(original);
    mutate(corrupt.draft);
    malformed.push(corrupt);
  }
  for (const invalid of malformed) assert.throws(() => store.write(parseProgress(JSON.stringify(invalid))));
  assert.throws(() => parseProgress('{'));
  assert.throws(() => parseProgress(' '.repeat(MAX_FILE_BYTES + 1)), /слишком большой/);
  assert.deepEqual(store.read().data, original);
});

test('blocked storage and quota failures keep the active page usable with an explicit warning', () => {
  const initial = recordRound(emptyProgress(), pack(select(start())));
  const final = recordRound(initial, pack(finish()));
  const unavailable = createProgressStore(null);
  assert.ok(unavailable.write(final));
  assert.deepEqual(unavailable.read().data, final);
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(initial));
  const store = createProgressStore(storage);
  assert.deepEqual(store.read().data, initial);
  storage.setItem = () => {throw new Error('QuotaExceededError');};
  assert.ok(store.write(final));
  assert.deepEqual(store.read().data, final, 'Do not restore the older disk state after a failed write.');
  const corrupt = createProgressStore({getItem: () => '{', setItem: () => {}, removeItem: () => {}});
  assert.deepEqual(corrupt.read().data, emptyProgress());
  assert.ok(corrupt.read().notice);
});

test('clear removes only this app save; deletion failure is reported and does not leak stale in-memory data', () => {
  const storage = memoryStorage();
  storage.setItem('other-app', 'keep');
  const store = createProgressStore(storage);
  const data = recordRound(emptyProgress(), pack(finish()));
  store.write(data);
  assert.equal(store.clear(), '');
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem('other-app'), 'keep');
  assert.deepEqual(store.read().data, emptyProgress());
  const blocked = createProgressStore({getItem: () => JSON.stringify(data), setItem: () => {throw new Error();}, removeItem: () => {throw new Error();}});
  blocked.read();
  assert.match(blocked.clear(), /Не удалось удалить/);
  assert.deepEqual(blocked.read().data, emptyProgress());
});
