import {useId, useState} from 'react';
import {acquisitionFor, adviceFor, guidance, itemByKey, type Position} from './guidance';
import type {ShopItem} from './types';

export default function ItemGuidance({item, onSelect}: {item: ShopItem; onSelect: (id: number) => void}) {
  const acquisition = acquisitionFor(item);
  const advice = adviceFor(item);
  const [position, setPosition] = useState<Position | undefined>(advice?.roles[0]?.positions[0]);
  const explanationId = useId();
  const role = advice?.roles.find(role => role.positions.includes(position!));
  const positions = guidance.positions.filter(position => advice?.roles.some(role => role.positions.includes(position.id)));
  const sources = [...new Set([...acquisition.sources, ...(advice?.sources ?? [])])];

  return <div className="item-guidance">
    <section className={`item-acquisition${acquisition.unavailable ? ' acquisition-unavailable' : ''}`} aria-label="Как получить предмет">
      <h3>{acquisition.unavailable ? 'Недоступен в обычном матче' : 'Как получить'}</h3>
      <p>{acquisition.text}</p>
      {acquisition.note && <p className="item-guidance-note">{acquisition.note}</p>}
      {acquisition.related?.length ? <div className="item-guidance-related">{acquisition.related.map(key => {
        const related = itemByKey.get(key);
        return related ? <button type="button" key={key} onClick={() => onSelect(related.id)}>{related.name}</button> : null;
      })}</div> : null}
    </section>
    {advice && <details className="item-advice">
      <summary>Когда полезен <span>{positions.map(position => position.id).join(' · ')}</span></summary>
      <div className="item-advice-body">
        <p>{advice.purpose}</p>
        <div className="item-position-buttons" role="group" aria-label="Примеры применения по позициям">
          {positions.map(entry => <button type="button" key={entry.id} aria-pressed={position === entry.id} aria-controls={explanationId} onClick={() => setPosition(entry.id)}>{entry.id} · {entry.name}</button>)}
        </div>
        <p className="item-position-explanation" id={explanationId} aria-live="polite">{role?.reason}</p>
        <p className="item-advice-caution"><strong>Учти: </strong>{advice.caution}</p>
        <p className="item-guidance-note">Ситуационные советы DotaReminder на основе эффектов предмета. Выбор зависит от героя и матча; перечислены примеры позиций.</p>
      </div>
    </details>}
    <details className="item-guidance-sources">
      <summary>Источники пояснений · {guidance.patch}</summary>
      <ul>{sources.map(id => {
        const source = guidance.sources[id];
        return source ? <li key={id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li> : null;
      })}</ul>
      <p>Пояснения от {guidance.reviewedAt.split('-').reverse().join('.')}. Обычный режим игры.</p>
    </details>
  </div>;
}
