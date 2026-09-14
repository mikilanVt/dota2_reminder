import {useState} from 'react';
import type {SessionQuestion} from './engine';

export function QuestionImage({question, reveal = false, onReady}: {
  question: SessionQuestion;
  reveal?: boolean;
  onReady?: (ready: boolean) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const hideName = question.recognition && !reveal;
  if (!question.image) return null;
  return (
    <figure className="training-item-image">
      {failed ? <div className="training-image-error" role="status">
        <p>Картинка не загрузилась.</p>
        <button className="training-back" type="button" onClick={() => {setFailed(false); setAttempt(value => value + 1);}}>Загрузить ещё раз</button>
      </div> : <img
        key={attempt}
        src={`${import.meta.env.BASE_URL}${question.image}${attempt ? `?retry=${attempt}` : ''}`}
        width="128" height="96" decoding="async"
        alt={hideName ? 'Предмет для распознавания' : question.entityName}
        onLoad={() => onReady?.(true)}
        onError={() => {setFailed(true); onReady?.(false);}}
      />}
      <figcaption className="training-entity">{hideName ? 'УЗНАЙ ПРЕДМЕТ' : question.entityName}</figcaption>
    </figure>
  );
}
