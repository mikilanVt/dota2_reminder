import {useEffect, useRef, useState} from 'react';
import type {TopicId} from '../../data/types';
import {starterItems} from '../../data/starter-items';
import {ProgressScreen} from '../progress/ProgressScreen';
import {emptyProgress, mergeProgress, parseProgress, reconcileProgress, recordRound, restoreRound, saveRound, type ProgressData, type SavedRound} from '../progress/model';
import {getProgressStore} from '../progress/storage';
import {createSession, missedQuestionIds, reduceSession, type TrainingAction, type TrainingSession} from './engine';
import {TrainingScreen} from './TrainingScreen';

export interface TrainingHubProps {
  topics: readonly TopicId[];
  entry: 'play' | 'progress';
  onExit: () => void;
}

type ActiveRound = {saved: SavedRound; session: TrainingSession};
function newRound(topics: readonly TopicId[], questionIds?: readonly string[]): ActiveRound {
  const session = createSession(starterItems, topics, {questionIds});
  const now = new Date().toISOString();
  const saved = saveRound(session, {
    id: crypto.randomUUID(), bankId: starterItems.id, patch: starterItems.patch,
    topics, kind: questionIds ? 'mistakes' : 'test', startedAt: now
  }, now);
  return {saved, session};
}

export function TrainingHub({topics, entry, onExit}: TrainingHubProps) {
  const store = getProgressStore();
  const [initial] = useState(() => {
    const loaded = store.read();
    const data = reconcileProgress(loaded.data, starterItems);
    const corrected = JSON.stringify(data) !== JSON.stringify(loaded.data);
    return {
      data, notice: loaded.notice || (corrected ? 'Сохранение сверено с текущими вопросами. Недоступные записи исключены, оценки пересчитаны.' : ''),
      round: entry === 'play' && !data.draft ? newRound(topics) : null
    };
  });
  const [progress, setProgress] = useState(initial.data);
  const progressRef = useRef(initial.data);
  const [notice, setNotice] = useState(initial.notice);
  const [storageNotice, setStorageNotice] = useState(initial.notice);
  const [active, setActive] = useState<ActiveRound | null>(initial.round);

  function persist(data: ProgressData) {
    progressRef.current = data;
    setProgress(data);
    const warning = store.write(data);
    setStorageNotice(warning);
    return warning;
  }

  useEffect(() => {
    // The same ID is reused in StrictMode; recording completion is idempotent.
    const data = initial.round?.session.questions.length
      ? recordRound(initial.data, initial.round.saved) : initial.data;
    const warning = persist(data);
    if (warning) setNotice(warning);
  }, []);

  function openRound(round: ActiveRound) {
    setNotice('');
    if (round.session.questions.length) persist(recordRound(progressRef.current, round.saved));
    setActive(round);
  }

  function dispatch(action: TrainingAction) {
    if (!active) return;
    const session = reduceSession(active.session, action);
    if (session === active.session) return;
    // A clock correction must not make an otherwise valid save unreadable.
    const now = new Date().toISOString();
    const saved = saveRound(session, active.saved, now < active.saved.startedAt ? active.saved.startedAt : now);
    openRound({saved, session});
  }

  function resume() {
    const saved = progressRef.current.draft;
    const session = saved && restoreRound(saved, starterItems);
    if (saved && session) openRound({saved, session});
    else setNotice('Данные теста изменились. Начни новый тест по проверенным вопросам.');
  }

  function startFresh(questionIds?: readonly string[]) {
    openRound(newRound(['items'], questionIds));
  }

  function importFile(text: string) {
    const imported = reconcileProgress(parseProgress(text), starterItems);
    const current = progressRef.current;
    const keptDraft = current.draft && imported.draft && current.draft.id !== imported.draft.id;
    const warning = persist(mergeProgress(current, imported));
    setNotice(warning || `Копия загружена. История объединена без дубликатов.${keptDraft ? ' Текущий незавершённый тест сохранён; тест из файла не заменил его.' : ''}`);
  }

  function clearProgress() {
    const data = emptyProgress();
    progressRef.current = data;
    setProgress(data);
    setActive(null);
    const warning = store.clear();
    setStorageNotice(warning);
    setNotice(warning || 'Прогресс в этом браузере удалён. Можно начать заново.');
  }

  return active ? (
    <TrainingScreen
      key={active.saved.id}
      session={active.session}
      repeatingMistakes={active.saved.kind === 'mistakes'}
      notice={storageNotice}
      onAction={dispatch}
      onRestart={onlyMistakes => startFresh(onlyMistakes ? missedQuestionIds(active.session) : undefined)}
      onProgress={() => {setActive(null); setNotice(storageNotice);}}
      onExit={onExit}
    />
  ) : (
    <ProgressScreen
      progress={progress} notice={notice || storageNotice}
      onResume={resume} onStart={startFresh} onImport={importFile}
      onClear={clearProgress} onNotice={setNotice} onExit={onExit}
    />
  );
}
