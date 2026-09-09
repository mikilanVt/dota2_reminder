import {useEffect, useRef, type FormEvent} from 'react';
import {starterItems} from '../../data/starter-items';
import {formatValue, missedQuestionIds, type TrainingAction, type TrainingSession} from './engine';
import './training.css';

export interface TrainingScreenProps {
  session: TrainingSession;
  repeatingMistakes: boolean;
  notice: string;
  onAction: (action: TrainingAction) => void;
  onRestart: (onlyMistakes: boolean) => void;
  onProgress: () => void;
  onExit: () => void;
}

export function TrainingScreen({session, repeatingMistakes, notice, onAction, onRestart, onProgress, onExit}: TrainingScreenProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const finished = session.phase === 'finished';
  const reviewing = session.phase === 'reviewing';
  const question = session.questions[session.index];
  const mistakes = missedQuestionIds(session);
  const correctCount = session.answers.filter(answer => answer.correct).length;

  useEffect(() => {
    if (session.phase === 'reviewing') feedback.current?.focus();
    else {
      window.scrollTo(0, 0);
      heading.current?.focus({preventScroll: true});
    }
  }, [session.index, session.phase, session.questions]);

  function checkAnswer(event: FormEvent) {
    event.preventDefault();
    onAction({type: 'check'});
  }

  return (
    <main className="training-screen">
      <section className="training-panel" aria-label="Тест по предметам Dota 2">
        <header className="training-header">
          <div>
            <p className="training-eyebrow">{repeatingMistakes ? 'ПОВТОР ОШИБОК' : 'ТЕСТЫ'} / ПРЕДМЕТЫ</p>
            <p className="training-patch">Патч {starterItems.patch}</p>
          </div>
          <div className="training-header-buttons">
            <button className="training-back" type="button" onClick={onProgress}>Мой прогресс</button>
            <button className="training-back" type="button" onClick={onExit}>В меню</button>
          </div>
        </header>
        <p className={`training-save-status${notice ? ' has-warning' : ''}`} role="status">
          {notice || (finished ? 'Результат сохранён в этом браузере.' : 'Сохраняется в этом браузере. Можно выйти и продолжить позже.')}
        </p>

        {finished ? (
          <div className="training-results">
            <h1 ref={heading} tabIndex={-1}>Тренировка завершена</h1>
            {session.questions.length ? (
              <>
                <p className="training-score"><strong>{correctCount}</strong> из {session.questions.length}</p>
                <p className="training-muted">Верных ответов: {Math.round(correctCount / session.questions.length * 100)}%</p>
                {mistakes.length ? (
                  <div className="training-mistakes">
                    <h2>Разбор ошибок</h2>
                    {session.answers.filter(answer => !answer.correct).map(answer => {
                      const failed = session.questions.find(entry => entry.id === answer.questionId)!;
                      const chosen = failed.options.find(option => option.id === answer.optionId)!;
                      return (
                        <details key={failed.id}>
                          <summary>{failed.prompt}</summary>
                          <p>Твой ответ: {chosen.label}</p>
                          <p className="training-correct">Правильный ответ: {formatValue(failed.fact)}</p>
                          <p>{failed.fact.explanation}</p>
                        </details>
                      );
                    })}
                  </div>
                ) : <p className="training-correct">Все ответы верные.</p>}
                <div className="training-actions">
                  {mistakes.length > 0 && <button className="training-primary" type="button" onClick={() => onRestart(true)}>Повторить ошибки</button>}
                  <button className={mistakes.length ? 'training-secondary' : 'training-primary'} type="button" onClick={() => onRestart(false)}>Новый тест</button>
                </div>
              </>
            ) : <p>Для выбранных тем пока нет проверенных вопросов.</p>}
          </div>
        ) : (
          <>
            <div className="training-progress-label">
              <span>Вопрос {session.index + 1} из {session.questions.length}</span>
              <span>{correctCount} верно</span>
            </div>
            <progress className="training-progress" value={session.answers.length} max={session.questions.length} aria-label="Завершённые вопросы" />
            <p className="training-entity">{question.entityName}</p>
            <h1 ref={heading} tabIndex={-1}>{question.prompt}</h1>
            <p className="training-conditions" id="question-conditions">
              {question.fact.conditions}
              {['здоровья', 'маны'].includes(question.fact.unit) && ' Недостающего ресурса хватает для полного эффекта.'}
            </p>

            <form onSubmit={checkAnswer}>
              <fieldset className="training-options" disabled={reviewing} aria-describedby="question-conditions">
                <legend className="training-sr-only">Выбери один ответ</legend>
                {question.options.map((option, index) => {
                  const selected = option.id === session.selectedOptionId;
                  const answerClass = reviewing
                    ? option.id === question.correctOptionId ? ' is-correct' : selected ? ' is-wrong' : ''
                    : selected ? ' is-selected' : '';
                  return (
                    <label key={option.id} className={`training-option${answerClass}`}>
                      <input type="radio" name={`answer-${question.id}`} value={option.id} checked={selected} onChange={() => onAction({type: 'select', optionId: option.id})} />
                      <span className="training-option-number" aria-hidden="true">{index + 1}</span>
                      <span>{option.label}</span>
                      {reviewing && option.id === question.correctOptionId && <span className="training-option-status">Верный ответ</span>}
                      {reviewing && selected && option.id !== question.correctOptionId && <span className="training-option-status">Твой ответ</span>}
                    </label>
                  );
                })}
              </fieldset>
              {!reviewing && <button className="training-primary" type="submit" disabled={session.selectedOptionId === null}>Проверить</button>}
            </form>

            {reviewing && (
              <>
                <div ref={feedback} className={`training-feedback ${session.answers[session.answers.length - 1].correct ? 'is-correct' : 'is-wrong'}`} tabIndex={-1} role="region" aria-label="Объяснение ответа">
                  <h2>{session.answers[session.answers.length - 1].correct ? 'Верно' : 'Неверно'}</h2>
                  <p>Правильный ответ: <strong>{formatValue(question.fact)}</strong></p>
                  <p>{question.fact.explanation}</p>
                  <details className="training-source">
                    <summary>Источник и дата проверки</summary>
                    <p><a href={question.fact.source.url} target="_blank" rel="noreferrer">{question.fact.source.title}</a></p>
                    <p>Проверено {question.fact.verification.checkedAt} для патча <a href={`https://www.dota2.com/patches/${starterItems.patch}`} target="_blank" rel="noreferrer">{starterItems.patch}</a>.</p>
                  </details>
                </div>
                <button className="training-primary" type="button" onClick={() => onAction({type: 'next'})}>
                  {session.index + 1 === session.questions.length ? 'Посмотреть результат' : 'Следующий вопрос'}
                </button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
