import type {QuestionBank, TopicId} from '../../data/types.js';
import {createSession, reduceSession, type TrainingSession} from '../training/engine.js';

export const MAX_HISTORY = 50;
export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_QUESTIONS = 10;

export interface SavedRound {
  id: string;
  bankId: string;
  patch: string;
  topics: readonly TopicId[];
  kind: 'test' | 'mistakes';
  startedAt: string;
  updatedAt: string;
  questions: readonly {id: string; optionIds: readonly string[]}[];
  answers: readonly {optionId: string; correct: boolean}[];
  selectedOptionId: string | null;
  phase: TrainingSession['phase'];
}

export interface ProgressData {
  version: 1;
  draft: SavedRound | null;
  history: readonly SavedRound[];
}

export const emptyProgress = (): ProgressData => ({version: 1, draft: null, history: []});
export const correctCount = (round: SavedRound) => round.answers.filter(answer => answer.correct).length;
export const mistakeIds = (round: SavedRound) => round.questions
  .filter((_, index) => round.answers[index]?.correct === false).map(question => question.id);

export function saveRound(session: TrainingSession, metadata: Pick<SavedRound,
  'id' | 'bankId' | 'patch' | 'topics' | 'kind' | 'startedAt'>, now: string): SavedRound {
  return {
    ...metadata, updatedAt: now,
    questions: session.questions.map(question => ({id: question.id, optionIds: question.options.map(option => option.id)})),
    answers: session.answers.map(({optionId, correct}) => ({optionId, correct})),
    selectedOptionId: session.selectedOptionId, phase: session.phase
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function id(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,96}$/.test(value);
}
function date(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function invalid(): never {throw new Error('Файл прогресса повреждён или имеет неподдерживаемый формат.');}

function parseRound(value: unknown): SavedRound {
  if (!object(value) || !id(value.id) || !id(value.bankId) || !id(value.patch)
    || !date(value.startedAt) || !date(value.updatedAt) || value.updatedAt < value.startedAt
    || (value.kind !== 'test' && value.kind !== 'mistakes')
    || (value.phase !== 'answering' && value.phase !== 'reviewing' && value.phase !== 'finished')) return invalid();
  if (!Array.isArray(value.topics) || value.topics.length < 1 || value.topics.length > 3
    || new Set(value.topics).size !== value.topics.length
    || !value.topics.every(topic => ['items', 'heroes', 'map'].includes(topic))) return invalid();
  if (!Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > MAX_QUESTIONS) return invalid();
  const questions = value.questions.map(question => {
    if (!object(question) || !id(question.id) || !Array.isArray(question.optionIds)
      || question.optionIds.length !== 4 || !question.optionIds.every(id)
      || new Set(question.optionIds).size !== 4) return invalid();
    return {id: question.id, optionIds: question.optionIds as string[]};
  });
  if (new Set(questions.map(question => question.id)).size !== questions.length
    || !Array.isArray(value.answers) || value.answers.length > questions.length) return invalid();
  const answers = value.answers.map((answer, index) => {
    if (!object(answer) || !id(answer.optionId) || typeof answer.correct !== 'boolean'
      || !questions[index].optionIds.includes(answer.optionId)) return invalid();
    return {optionId: answer.optionId, correct: answer.correct};
  });
  if (value.phase === 'answering') {
    if (answers.length >= questions.length || (value.selectedOptionId !== null
      && (!id(value.selectedOptionId) || !questions[answers.length].optionIds.includes(value.selectedOptionId)))) return invalid();
  } else if (!answers.length || value.selectedOptionId !== answers[answers.length - 1].optionId
    || (value.phase === 'finished' && answers.length !== questions.length)) return invalid();
  // Copy only supported fields. Imported text never becomes game content or HTML.
  return {
    id: value.id, bankId: value.bankId, patch: value.patch,
    topics: value.topics as TopicId[], kind: value.kind as SavedRound['kind'],
    startedAt: value.startedAt, updatedAt: value.updatedAt, questions, answers,
    selectedOptionId: value.selectedOptionId as string | null, phase: value.phase as SavedRound['phase']
  };
}

export function parseProgress(text: string): ProgressData {
  if (text.length > MAX_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES)
    throw new Error('Файл слишком большой. Максимум — 256 КБ.');
  let value: unknown;
  try {value = JSON.parse(text);} catch {return invalid();}
  if (!object(value) || value.version !== 1 || !Array.isArray(value.history)
    || value.history.length > MAX_HISTORY || !('draft' in value)) return invalid();
  const history = value.history.map(parseRound);
  const draft = value.draft === null ? null : parseRound(value.draft);
  if (history.some(round => round.phase !== 'finished') || draft?.phase === 'finished'
    || new Set(history.map(round => round.id)).size !== history.length
    || (draft && history.some(round => round.id === draft.id))) return invalid();
  return {version: 1, draft, history};
}

export function restoreRound(round: SavedRound, bank: QuestionBank): TrainingSession | null {
  if (round.bankId !== bank.id || round.patch !== bank.patch) return null;
  const eligible = createSession(bank, round.topics, {limit: bank.questions.length || 1, random: () => .99});
  const questions = round.questions.map(saved => {
    const question = eligible.questions.find(entry => entry.id === saved.id);
    if (!question || saved.optionIds.length !== question.options.length
      || new Set(saved.optionIds).size !== question.options.length) return null;
    const options = saved.optionIds.map(optionId => question.options.find(option => option.id === optionId));
    return options.every(option => option !== undefined) ? {...question, options} : null;
  });
  if (!questions.length || questions.some(question => question === null)
    || new Set(questions.map(question => question?.id)).size !== questions.length) return null;
  let session: TrainingSession = {
    questions: questions as TrainingSession['questions'], index: 0, selectedOptionId: null, answers: [], phase: 'answering'
  };
  for (const [index, answer] of round.answers.entries()) {
    session = reduceSession(session, {type: 'select', optionId: answer.optionId});
    session = reduceSession(session, {type: 'check'});
    if (session.answers.length !== index + 1) return null;
    if (index < round.answers.length - 1 || round.phase !== 'reviewing') session = reduceSession(session, {type: 'next'});
  }
  if (session.phase !== round.phase) return null;
  if (session.phase === 'answering' && round.selectedOptionId !== null)
    session = reduceSession(session, {type: 'select', optionId: round.selectedOptionId});
  return session.selectedOptionId === round.selectedOptionId ? session : null;
}

export function reconcileProgress(progress: ProgressData, bank: QuestionBank): ProgressData {
  // Scores for the current bank are recalculated from answer IDs, never trusted
  // from an imported file. Earlier patches remain explicitly historical.
  const normalize = (round: SavedRound) => {
    if (round.bankId !== bank.id || round.patch !== bank.patch) return round;
    const session = restoreRound(round, bank);
    return session ? saveRound(session, round, round.updatedAt) : null;
  };
  return mergeProgress({
    version: 1, draft: progress.draft ? normalize(progress.draft) : null,
    history: progress.history.map(normalize).filter((round): round is SavedRound => round !== null)
  }, emptyProgress());
}

export function mergeProgress(current: ProgressData, incoming: ProgressData): ProgressData {
  const byId = new Map<string, SavedRound>();
  for (const round of [...incoming.history, ...current.history]) {
    const previous = byId.get(round.id);
    if (!previous || round.updatedAt >= previous.updatedAt) byId.set(round.id, round);
  }
  const history = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).slice(0, MAX_HISTORY);
  const candidate = current.draft ?? incoming.draft;
  const data: ProgressData = {version: 1, draft: candidate && !byId.has(candidate.id) ? candidate : null, history};
  // Keep both localStorage (UTF-16) and exported files bounded, even at maximum
  // identifier lengths. Normal progress stays far below this ceiling.
  while (JSON.stringify(data).length > MAX_FILE_BYTES && history.length) history.pop();
  return data;
}

export function recordRound(progress: ProgressData, round: SavedRound): ProgressData {
  if (round.phase === 'finished') return mergeProgress(
    {...progress, draft: progress.draft?.id === round.id ? null : progress.draft},
    {version: 1, draft: null, history: [round]}
  );
  return mergeProgress({...progress, draft: round}, emptyProgress());
}
