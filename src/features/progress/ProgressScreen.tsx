import {useEffect, useRef, useState, type ChangeEvent} from 'react';
import {starterItems} from '../../data/starter-items';
import {formatValue} from '../training/engine';
import {correctCount, MAX_FILE_BYTES, MAX_HISTORY, mistakeIds, restoreRound, type ProgressData, type SavedRound} from './model';
import '../training/training.css';
import './progress.css';

interface ProgressScreenProps {
  progress: ProgressData;
  notice: string;
  onResume: () => void;
  onStart: (questionIds?: readonly string[]) => void;
  onImport: (text: string) => void;
  onClear: () => void;
  onNotice: (notice: string) => void;
  onExit: () => void;
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {dateStyle: 'medium', timeStyle: 'short'});
const currentBank = (round: SavedRound) => round.bankId === starterItems.id && round.patch === starterItems.patch;

function HistoryRow({round, onRetry, hasDraft}: {round: SavedRound; onRetry: (ids: readonly string[]) => void; hasDraft: boolean}) {
  const [open, setOpen] = useState(false);
  const session = open ? restoreRound(round, starterItems) : null;
  const mistakes = mistakeIds(round);
  return (
    <details className="progress-history-row" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>
        <span><time dateTime={round.updatedAt}>{dateFormat.format(new Date(round.updatedAt))}</time><small>{round.kind === 'mistakes' ? 'Повтор ошибок' : 'Тест по предметам'} · патч {round.patch}{!currentBank(round) && ' · архив'}</small></span>
        <strong>{correctCount(round)} / {round.questions.length}</strong>
      </summary>
      {open && (session ? (
        <div className="progress-review">
          {mistakes.length ? <>
            {session.answers.filter(answer => !answer.correct).map(answer => {
              const question = session.questions.find(entry => entry.id === answer.questionId)!;
              const chosen = question.options.find(option => option.id === answer.optionId)!;
              return <div className="progress-mistake" key={question.id}>
                <p><strong>{question.prompt}</strong></p>
                <p>Твой ответ: {chosen.label}</p>
                <p className="training-correct">Верный ответ: {formatValue(question.fact)}</p>
                <p>{question.fact.explanation}</p>
              </div>;
            })}
            <button className="training-secondary" type="button" disabled={hasDraft} onClick={() => onRetry(mistakes)}>Повторить эти ошибки</button>
            {hasDraft && <p className="training-muted">Сначала заверши сохранённый тест или начни новый вместо него.</p>}
          </> : <p className="training-correct">Все ответы верные.</p>}
        </div>
      ) : <p className="training-muted">Результат относится к прежней версии вопросов. Объяснения и повтор станут доступны для новых тренировок по текущим данным.</p>)}
    </details>
  );
}

export function ProgressScreen({progress, notice, onResume, onStart, onImport, onClear, onNotice, onExit}: ProgressScreenProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importVersion = useRef(0);
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [visible, setVisible] = useState(10);
  const current = progress.history.filter(currentBank);
  const answerCount = current.reduce((sum, round) => sum + round.answers.length, 0);
  const correct = current.reduce((sum, round) => sum + correctCount(round), 0);
  const draft = progress.draft;
  const canResume = draft && restoreRound(draft, starterItems) !== null;

  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({preventScroll: true});
    return () => {importVersion.current++;};
  }, []);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const version = ++importVersion.current;
    setImporting(true);
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('Файл слишком большой. Максимум — 256 КБ.');
      const text = await file.text();
      if (version === importVersion.current) {
        onImport(text);
        setConfirmClear(false);
        setConfirmNew(false);
      }
    } catch (error) {
      if (version === importVersion.current) onNotice(error instanceof Error ? error.message : 'Не удалось прочитать файл.');
    } finally {
      if (version === importVersion.current) setImporting(false);
    }
  }

  function exportFile() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(progress)], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dotareminder-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotice('Копия подготовлена для скачивания. Её можно загрузить в другом браузере через «Загрузить копию».');
  }

  function start() {
    if (draft && !confirmNew) {setConfirmNew(true); return;}
    onStart();
  }

  return (
    <main className="training-screen">
      <section className="training-panel progress-panel" aria-label="Локальный прогресс">
        <header className="training-header">
          <div><p className="training-eyebrow">ТВОИ ТРЕНИРОВКИ</p><p className="training-patch">Предметы · патч {starterItems.patch}</p></div>
          <button className="training-back" type="button" onClick={onExit}>В меню</button>
        </header>
        <h1 ref={heading} tabIndex={-1}>Мой прогресс</h1>
        <p className="training-muted">Результаты сохраняются только в этом браузере. Для переноса на другое устройство скачай копию. Очистка данных сайта удалит сохранение.</p>
        {notice && <p className="progress-notice" role="status">{notice}</p>}

        {draft && <section className="progress-draft" aria-label="Незавершённый тест">
          <h2>{canResume ? 'Продолжить тренировку' : 'Сохранённый тест устарел'}</h2>
          <p>{draft.kind === 'mistakes' ? 'Повтор ошибок' : 'Предметы'} · патч {draft.patch} · проверено {draft.answers.length} из {draft.questions.length}</p>
          <p className="training-muted">{canResume ? 'Вопросы, порядок ответов и выбранный вариант сохранены.' : 'Набор вопросов изменился. Начни новый тест, чтобы тренироваться по проверенным данным.'}</p>
          {canResume && <button className="training-primary" type="button" disabled={importing} onClick={onResume}>Продолжить тест</button>}
        </section>}

        <div className="progress-stats" aria-label="Статистика текущего набора вопросов">
          <div><strong>{current.length}</strong><span>завершено</span></div>
          <div><strong>{answerCount ? `${Math.round(correct / answerCount * 100)}%` : '—'}</strong><span>верных ответов</span></div>
          <div><strong>{answerCount - correct}</strong><span>ошибок</span></div>
        </div>
        <p className="progress-caption">Статистика текущего набора, включая повторы ошибок. Храним до {MAX_HISTORY} последних тренировок. Прежние версии отмечены в истории как архив.</p>
        <div className="training-actions">
          <button className="training-primary" type="button" disabled={importing} onClick={start}>{confirmNew ? 'Начать вместо сохранённого' : 'Новый тест по предметам'}</button>
          {confirmNew && <button className="training-secondary" type="button" onClick={() => setConfirmNew(false)}>Отмена</button>}
        </div>
        {confirmNew && <p className="progress-notice" role="status">Незавершённый тест будет заменён. Завершённые результаты останутся в истории.</p>}

        <section className="progress-history" aria-label="История тренировок">
          <h2>История</h2>
          {progress.history.length ? <>
            {progress.history.slice(0, visible).map(round => <HistoryRow key={round.id} round={round} hasDraft={Boolean(draft) || importing} onRetry={onStart} />)}
            {progress.history.length > visible && <button className="training-secondary progress-more" type="button" onClick={() => setVisible(count => count + 10)}>Показать ещё</button>}
          </> : <p className="training-muted">Здесь появится результат первого завершённого теста.</p>}
        </section>

        <section className="progress-transfer" aria-label="Перенос и удаление прогресса">
          <h2>Сохранение</h2>
          <p className="training-muted">Загрузка копии объединяет историю без дубликатов и сохраняет твой текущий незавершённый тест. Аккаунт не нужен.</p>
          <div className="training-actions">
            <button className="training-secondary" type="button" onClick={exportFile}>Скачать копию</button>
            <button className="training-secondary" type="button" disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? 'Загружаем…' : 'Загрузить копию'}</button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={readFile} aria-label="Файл прогресса DotaReminder" />
          </div>
          {confirmClear ? <div className="progress-clear-confirm" role="group" aria-label="Подтверждение удаления">
            <p>Удалить всю историю и незавершённый тест в этом браузере? Восстановить их можно будет только из скачанной копии.</p>
            <div className="training-actions">
              <button className="training-secondary progress-danger" type="button" disabled={importing} onClick={() => {importVersion.current++; onClear(); setConfirmClear(false); setConfirmNew(false);}}>Удалить прогресс</button>
              <button className="training-secondary" type="button" onClick={() => setConfirmClear(false)}>Отмена</button>
            </div>
          </div> : <button className="progress-clear" type="button" disabled={importing} onClick={() => setConfirmClear(true)}>Очистить прогресс</button>}
        </section>
      </section>
    </main>
  );
}
