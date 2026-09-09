import type {GameFact, QuestionBank, TopicId} from '../../data/types.js';

export interface AnswerOption {id: string; value: number; label: string}
export interface SessionQuestion {
  id: string;
  prompt: string;
  entityName: string;
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

const numberFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2});
export const formatValue = (fact: GameFact, value = fact.value) => `${numberFormat.format(value)} ${fact.unit}`;

export function validateBank(bank: QuestionBank): void {
  for (const records of [bank.entities, bank.facts, bank.questions]) {
    if (new Set(records.map(record => record.id)).size !== records.length)
      throw new Error('Duplicate IDs in the question bank.');
  }
  for (const fact of bank.facts) {
    if (!bank.entities.some(entity => entity.id === fact.entityId && entity.topic === fact.topic))
      throw new Error(`Unknown entity: ${fact.entityId}`);
    if (!Number.isFinite(fact.value) || !fact.conditions || !fact.explanation || !fact.evidence.length)
      throw new Error(`Incomplete fact: ${fact.id}`);
    if (!fact.source.url.startsWith('https://') || !fact.verification.checkedAt || !fact.verification.patch)
      throw new Error(`Missing provenance: ${fact.id}`);
  }
  for (const question of bank.questions) {
    const fact = bank.facts.find(record => record.id === question.factId);
    if (!fact) throw new Error(`Unknown fact: ${question.factId}`);
    const values = [fact.value, ...question.distractors];
    if (!question.prompt || values.length !== 4 || values.some(value => !Number.isFinite(value)) || new Set(values).size !== 4)
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
  const candidates = bank.questions.filter(question => {
    const fact = bank.facts.find(record => record.id === question.factId)!;
    const entity = bank.entities.find(record => record.id === fact.entityId)!;
    return topics.includes(fact.topic)
      && fact.verification.status === 'verified' && fact.verification.patch === bank.patch
      && entity.verification.status === 'verified' && entity.verification.patch === bank.patch
      && (!options.questionIds || options.questionIds.includes(question.id));
  });
  const questions = shuffle(candidates, random).slice(0, limit).map(question => {
    const fact = bank.facts.find(record => record.id === question.factId)!;
    const entityName = bank.entities.find(entity => entity.id === fact.entityId)!.name;
    const answerOptions = [fact.value, ...question.distractors].map((value, index) => ({
      id: `${question.id}:${index}`, value, label: formatValue(fact, value)
    }));
    return {
      id: question.id, prompt: question.prompt, entityName, fact,
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
