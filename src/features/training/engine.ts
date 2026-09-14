import type {AnswerValue, GameFact, QuestionBank, TopicId} from '../../data/types.js';

export interface AnswerOption {id: string; value: AnswerValue; label: string}
export interface SessionQuestion {
  id: string;
  prompt: string;
  entityName: string;
  image?: string;
  recognition: boolean;
  fact: GameFact;
  options: readonly AnswerOption[];
  correctOptionId: string;
}
export interface SessionAnswer {questionId: string; optionId: string; correct: boolean}
export interface TrainingSession {
  questions: readonly SessionQuestion[];
  index: number;
  selectedOptionId: string | null;
  answers: readonly SessionAnswer[];
  phase: 'answering' | 'reviewing' | 'finished';
}
export type TrainingAction = {type: 'select'; optionId: string} | {type: 'check'} | {type: 'next'};

const numberFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 3});
export const formatValue = (fact: GameFact, value = fact.value) => typeof value === 'string' ? value : `${numberFormat.format(value)} ${fact.unit}`.trim();
const validValue = (value: AnswerValue) => typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string' && value.trim().length > 0;

export function validateBank(bank: QuestionBank): void {
  const entities = new Map(bank.entities.map(entity => [entity.id, entity]));
  const facts = new Map(bank.facts.map(fact => [fact.id, fact]));
  for (const records of [bank.entities, bank.facts, bank.questions]) {
    if (new Set(records.map(record => record.id)).size !== records.length)
      throw new Error('Duplicate IDs in the question bank.');
  }
  for (const fact of bank.facts) {
    if (entities.get(fact.entityId)?.topic !== fact.topic)
      throw new Error(`Unknown entity: ${fact.entityId}`);
    if (!validValue(fact.value) || !fact.conditions || !fact.explanation || !fact.evidence.length)
      throw new Error(`Incomplete fact: ${fact.id}`);
    if (!fact.source.url.startsWith('https://') || !fact.verification.checkedAt || !fact.verification.patch)
      throw new Error(`Missing provenance: ${fact.id}`);
  }
  for (const question of bank.questions) {
    const fact = facts.get(question.factId);
    if (!fact) throw new Error(`Unknown fact: ${question.factId}`);
    const values = [fact.value, ...question.distractors];
    if (!question.prompt || values.length < 2 || values.length > 4 || values.some(value => !validValue(value) || typeof value !== typeof fact.value)
      || new Set(values.map(value => formatValue(fact, value))).size !== values.length)
      throw new Error(`Invalid answer options: ${question.id}`);
  }
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createSession(
  bank: QuestionBank,
  topics: readonly TopicId[],
  options: {limit?: number; questionIds?: readonly string[]; random?: () => number} = {}
): TrainingSession {
  validateBank(bank);
  const limit = options.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid question limit.');
  const random = options.random ?? Math.random;
  const facts = new Map(bank.facts.map(fact => [fact.id, fact]));
  const entities = new Map(bank.entities.map(entity => [entity.id, entity]));
  const wanted = options.questionIds ? new Set(options.questionIds) : null;
  const candidates = bank.questions.filter(question => {
    const fact = facts.get(question.factId)!;
    const entity = entities.get(fact.entityId)!;
    return topics.includes(fact.topic)
      && fact.verification.status === 'verified' && fact.verification.patch === bank.patch
      && entity.verification.status === 'verified' && entity.verification.patch === bank.patch
      && (!wanted || wanted.has(question.id));
  });
  const randomized = shuffle(candidates, random);
  // A normal round spans different subjects and items; a mistake retry preserves
  // the requested set. New questions stay reachable in the remainder pool.
  const selected: typeof randomized = [];
  const usedItems = new Set<string>();
  if (!wanted && bank.questions.some(question => question.category)) {
    for (const category of ['recognition', 'price', 'stats', 'mana', 'cooldown', 'effect', 'damage', 'dispel', 'tier', 'timing']) {
      const question = randomized.find(q => q.category === category && !usedItems.has(facts.get(q.factId)!.entityId));
      if (question && selected.length < limit) {
        selected.push(question);
        usedItems.add(facts.get(question.factId)!.entityId);
      }
    }
  }
  for (const question of randomized) if (selected.length < limit && !selected.includes(question)) selected.push(question);
  const questions = shuffle(selected, random).map(question => {
    const fact = facts.get(question.factId)!;
    const entity = entities.get(fact.entityId)!;
    const answerOptions = [fact.value, ...question.distractors].map((value, index) => ({
      id: `${question.id}:${index}`, value, label: formatValue(fact, value)
    }));
    return {
      id: question.id, prompt: question.prompt, entityName: entity.name, image: entity.image, recognition: question.category === 'recognition', fact,
      options: shuffle(answerOptions, random), correctOptionId: answerOptions[0].id
    };
  });
  return {questions, index: 0, selectedOptionId: null, answers: [], phase: questions.length ? 'answering' : 'finished'};
}

export function reduceSession(state: TrainingSession, action: TrainingAction): TrainingSession {
  if (state.phase === 'finished') return state;
  const question = state.questions[state.index];
  if (action.type === 'select') {
    if (state.phase !== 'answering' || !question.options.some(option => option.id === action.optionId)) return state;
    return {...state, selectedOptionId: action.optionId};
  }
  if (action.type === 'check') {
    if (state.phase !== 'answering' || state.selectedOptionId === null) return state;
    return {
      ...state, phase: 'reviewing',
      answers: [...state.answers, {
        questionId: question.id, optionId: state.selectedOptionId,
        correct: state.selectedOptionId === question.correctOptionId
      }]
    };
  }
  if (state.phase !== 'reviewing') return state;
  return state.index + 1 === state.questions.length
    ? {...state, phase: 'finished'}
    : {...state, index: state.index + 1, selectedOptionId: null, phase: 'answering'};
}

export const missedQuestionIds = (state: TrainingSession) => state.answers.filter(answer => !answer.correct).map(answer => answer.questionId);
