import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {asset, groups} from './itemShop';
import {RecipeDiagram} from './RecipeDiagram';
import type {ItemDescription, ShopItem} from './types';

const cache = new Map<number, ItemDescription>();
const panelStyle = {'--information-panel': `url(${asset('information-panel.png')})`} as CSSProperties;
const numbers = (values: readonly number[]) => values.map(value => value.toLocaleString('ru-RU', {useGrouping: false})).join(' / ');

function useItemDescription(item: ShopItem) {
  const [data, setData] = useState<ItemDescription | null>(() => cache.get(item.id) ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    const cached = cache.get(item.id);
    setData(cached ?? null);
    if (!cached) fetch(asset(`details/${item.id}.json`), {signal: controller.signal})
      .then(response => {if (!response.ok) throw new Error('Missing item'); return response.json();})
      .then((result: ItemDescription) => {
        if (controller.signal.aborted) return;
        if (result.id !== item.id || !result.source?.startsWith('https://www.dota2.com/')) throw new Error('Unexpected item data');
        if (cache.size >= 12) cache.delete(cache.keys().next().value!);
        cache.set(item.id, result);
        setData(result);
      })
      .catch(() => {if (!controller.signal.aborted) setError(true);});
    return () => controller.abort();
  }, [item.id, attempt]);
  return {data: data?.id === item.id ? data : null, error, retry: () => setAttempt(value => value + 1)};
}

function GameText({text}: {text: string}) {
  return <>{text.split(/([+−-]?\d+(?:[.,]\d+)?%?)/g).map((part, index) => /\d/.test(part) && /^[+−-]?\d/.test(part) ? <strong key={index}>{part}</strong> : part)}</>;
}

export function EmptyInformation() {
  return <div className="item-information item-information-empty" style={panelStyle} aria-label="Предмет не выбран"><div className="empty-information-body" /><div className="item-recipe" aria-hidden="true" /></div>;
}

export function ItemInformation({item, onSelect, onBack, onClose}: {item: ShopItem; onSelect: (id: number) => void; onBack?: () => void; onClose?: () => void}) {
  const {data, error, retry} = useItemDescription(item);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {if (scroll.current) scroll.current.scrollTop = 0;}, [item.id]);
  const group = groups.find(entry => entry.id === item.group);
  return <div className="item-information" style={panelStyle}>
    <header className="item-information-header">
      <img src={asset(`icons/${item.icon}`)} width="88" height="64" alt="" />
      <div>
        <h2 id="item-info-title">{item.name}</h2>
        {group?.tier ? <p className="item-neutral-label">Нейтральный предмет <span className={`neutral-tier-${group.tier}`}>{group.tier} разряда</span></p>
          : group?.id === 'enhancements' ? <p className="item-neutral-label">Нейтральные чары</p>
          : data && data.cost > 0 ? <p className="item-cost"><span aria-hidden="true">●</span> {data.cost.toLocaleString('ru-RU')}</p> : null}
      </div>
      {onClose && <button type="button" className="item-info-close" onClick={onClose} aria-label="Закрыть информацию">×</button>}
    </header>
    <div ref={scroll} className="item-information-scroll" tabIndex={0} aria-label={`Описание ${item.name}`}>
      {error ? <div className="item-description-notice" role="status"><p>Не удалось загрузить описание.</p><button type="button" className="item-small-button" onClick={retry}>Попробовать ещё раз</button></div> : !data ? <p className="item-description-notice" role="status">Загружаем описание…</p> : <>
        {data.properties.length > 0 && <dl className="item-properties">{data.properties.map(property => <div key={property.label}><dt>{property.label}: </dt><dd className={property.kind}>{property.value}</dd></div>)}</dl>}
        {data.stats.length > 0 && <ul className="item-stats">{data.stats.map((stat, index) => <li key={`${stat.label}-${index}`} className={stat.penalty ? 'stat-penalty' : undefined}><span className="stat-sign">{stat.sign}</span><strong>{stat.value}</strong> {stat.label}</li>)}</ul>}
        {data.abilities.map((ability, index) => <section className={`item-ability ability-${ability.kind}`} key={index}>
          {(ability.title || ability.mana.some(Boolean) || ability.cooldown.some(Boolean)) && <div className="item-ability-heading">
            <h3 title={ability.title}>{ability.title}</h3>
            <div className="item-ability-parameters">
              {ability.range.some(value => value > 0) && <span title="Дальность применения" aria-label={`Дальность применения: ${numbers(ability.range)}`}><i className="ability-range-icon" aria-hidden="true" />{numbers(ability.range)}</span>}
              {ability.mana.some(Boolean) && <span title="Расход маны" aria-label={`Расход маны: ${numbers(ability.mana)}`}><i className="ability-mana-icon" aria-hidden="true" />{numbers(ability.mana)}</span>}
              {ability.cooldown.some(Boolean) && <span title="Перезарядка, сек." aria-label={`Перезарядка: ${numbers(ability.cooldown)} сек.`}><i className="ability-cooldown-icon" aria-hidden="true" />{numbers(ability.cooldown)}</span>}
              {ability.channel.some(Boolean) && <span title="Время произнесения, сек." aria-label={`Произнесение: ${numbers(ability.channel)} сек.`}>◷ {numbers(ability.channel)}</span>}
            </div>
          </div>}
          {ability.description && <div className="item-ability-description">{ability.description.split(/\n\n+/).map((paragraph, index) => <p key={index}><GameText text={paragraph} /></p>)}</div>}
        </section>)}
        {data.notes.length > 0 && <div className="item-notes">{data.notes.map((note, index) => <p key={index}><GameText text={note} /></p>)}</div>}
        {data.unresolved && <p className="item-description-notice">Часть параметров пока не расшифрована. Они отмечены многоточием.</p>}
        {data.lore && <p className="item-lore">{data.lore}</p>}
        <footer className="item-source"><a href={data.source} target="_blank" rel="noreferrer">Данные Valve</a><span>{data.retrievedAt.split('-').reverse().join('.')}</span></footer>
      </>}
    </div>
    <RecipeDiagram item={item} onSelect={onSelect} onBack={onBack} />
  </div>;
}
