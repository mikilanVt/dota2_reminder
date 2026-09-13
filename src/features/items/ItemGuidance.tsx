import {useId, useState} from 'react';
import {adviceFor, guidance, itemByKey, type Position} from './guidance';
import type {ShopItem} from './types';

export default function ItemGuidance({item, onSelect}: {item: ShopItem; onSelect: (id: number) => void}) {
  const advice = adviceFor(item);
  const [position, setPosition] = useState<Position | undefined>(advice?.roles[0]?.positions[0]);
  const explanationId = useId();
  const role = advice?.roles.find(role => role.positions.includes(position!));
  const positions = guidance.positions.filter(position => advice?.roles.some(role => role.positions.includes(position.id)));
  if (!advice) return null;

  return <div className="item-guidance">
    <details className="item-advice">
      <summary>Когда полезен <span>{positions.map(position => position.id).join(' · ')}</span></summary>
      <div className="item-advice-body">
        <p>{advice.purpose}</p>
        {positions.length > 0 && <div className="item-position-buttons" role="group" aria-label="Примеры применения по позициям">
          {positions.map(entry => <button type="button" key={entry.id} aria-pressed={position === entry.id} aria-controls={explanationId} onClick={() => setPosition(entry.id)}>{entry.id} · {entry.name}</button>)}
        </div>}
        {role && <p className="item-position-explanation" id={explanationId} aria-live="polite">{role.reason}</p>}
        {advice.tips.length > 0 && <ul className="item-advice-tips">{advice.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>}
        {advice.heroes?.length ? <p className="item-advice-heroes"><strong>Примеры героев: </strong>{advice.heroes.join(', ')}.</p> : null}
        <p className="item-advice-caution"><strong>Учти: </strong>{advice.caution}</p>
        {advice.alternatives?.length ? <div className="item-guidance-related" aria-label="Предметы для сравнения"><span>Сравнить с:</span>{advice.alternatives.map(key => {
          const related = itemByKey.get(key);
          return related ? <button type="button" key={key} onClick={() => onSelect(related.id)}>{related.name}</button> : null;
        })}</div> : null}
      </div>
    </details>
  </div>;
}
