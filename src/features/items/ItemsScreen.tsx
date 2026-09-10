import {useEffect, useRef, useState, type CSSProperties} from 'react';
import catalog from '../../data/item-shop-catalog.json';
import type {ItemDescription, ShopGroup, ShopItem} from './types';
import './items.css';

const groups = catalog.groups as ShopGroup[];
const asset = (path: string) => `${import.meta.env.BASE_URL}assets/item-shop/${path}`;
const columns = [
  {id: 'basic', title: 'ОСНОВНЫЕ'},
  {id: 'upgrades', title: 'УЛУЧШЕНИЯ'},
  {id: 'neutral', title: 'НЕЙТРАЛЬНЫЕ ПРЕДМЕТЫ'}
] as const;
const cache = new Map<number, ItemDescription>();
const normalize = (value: string) => value.toLowerCase().replaceAll('ё', 'е').replaceAll('_', ' ').trim();

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

function ItemInformation({item, onClose}: {item: ShopItem; onClose?: () => void}) {
  const {data, error, retry} = useItemDescription(item);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {if (scroll.current) scroll.current.scrollTop = 0;}, [item.id]);
  const group = groups.find(entry => entry.id === item.group)!;
  return <div className="item-information" style={{'--information-panel': `url(${asset('information-panel.png')})`} as CSSProperties}>
    <header className="item-information-header">
      <img src={asset(`icons/${item.icon}`)} width="88" height="64" alt="" />
      <div>
        <h2 id="item-info-title">{item.name}</h2>
        {data && <p className="item-cost">{data.cost > 0 ? <><span aria-hidden="true">●</span> {data.cost.toLocaleString('ru-RU')}</> : group.id === 'enhancements' ? 'Нейтральные чары' : group.column === 'neutral' ? 'Нейтральный предмет' : 'Не продаётся'}</p>}
      </div>
      {onClose && <button type="button" className="item-info-close" onClick={onClose} aria-label="Закрыть информацию">×</button>}
    </header>
    <div ref={scroll} className="item-information-scroll" tabIndex={0} aria-label={`Описание ${item.name}`}>
      <p className="item-type">{group.title}</p>
      {error ? <div className="item-description-notice" role="status"><p>Не удалось загрузить описание.</p><button type="button" className="item-small-button" onClick={retry}>Попробовать ещё раз</button></div> : !data ? <p className="item-description-notice" role="status">Загружаем описание…</p> : <>
        {data.stats.length > 0 && <dl className="item-stats">{data.stats.map((stat, index) => <div key={`${stat.label}-${index}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
        {(data.mana.some(Boolean) || data.cooldown.some(Boolean) || data.channel.some(Boolean)) && <div className="item-ability-costs">
          {data.mana.some(Boolean) && <span><i className="item-mana-symbol" aria-hidden="true" />{data.mana.join(' / ')} <small>маны</small></span>}
          {data.cooldown.some(Boolean) && <span>◷ {data.cooldown.join(' / ')} <small>сек.</small></span>}
          {data.channel.some(Boolean) && <span>Произнесение: {data.channel.join(' / ')} <small>сек.</small></span>}
        </div>}
        {data.description && <div className="item-effect">{data.description.split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
        {data.notes.length > 0 && <div className="item-notes">{data.notes.map((note, index) => <p key={index}>{note}</p>)}</div>}
        {data.unresolved && <p className="item-description-notice">Часть параметров пока не расшифрована. Они отмечены многоточием; сведения можно сверить с источником.</p>}
        {data.lore && <p className="item-lore">{data.lore}</p>}
        <footer className="item-source"><a href={data.source} target="_blank" rel="noreferrer">Данные Valve</a><span>Получены {data.retrievedAt.split('-').reverse().join('.')}</span></footer>
      </>}
    </div>
  </div>;
}

export function ItemsScreen() {
  const [selected, setSelected] = useState<ShopItem>(groups[0].items[0]);
  const [query, setQuery] = useState('');
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const [infoOpen, setInfoOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastSelected = useRef<HTMLButtonElement | null>(null);
  const search = normalize(query);
  const filtered = groups.map(group => ({...group, items: group.items.filter(item => !search
    || normalize(`${item.name} ${item.englishName} ${item.key}`).includes(search))}));
  const found = new Set(filtered.flatMap(group => group.items.map(item => item.id))).size;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (compact && infoOpen && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [compact, infoOpen]);

  function closeInfo() {
    dialog.current?.close();
    setInfoOpen(false);
    lastSelected.current?.focus();
  }

  return <main className="items-screen">
    <div className="item-shop-toolbar">
      <label className="item-search"><span>Поиск предмета</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Название предмета…" autoComplete="off" /></label>
      <p className="item-shop-version">{search ? `Найдено: ${found}` : `Данные на ${catalog.retrievedAt.split('-').reverse().join('.')}`}</p>
    </div>
    <div className="item-shop-grid">
      {columns.map(column => <section key={column.id} className={`item-shop-column item-column-${column.id}`} aria-labelledby={`item-column-title-${column.id}`}>
        <h1 id={`item-column-title-${column.id}`}>{column.title}</h1>
        <div className="item-shop-surface">
          {filtered.filter(group => group.column === column.id).map(group => <section className={`item-group item-group-${group.id}${!group.items.length ? ' is-empty' : ''}`} key={group.id}>
            <h2>{group.title}</h2>
            <div className="item-icon-grid">
              {group.items.map(item => <button className={`item-tile${selected.id === item.id ? ' is-selected' : ''}`} type="button" key={item.id}
                title={item.name} aria-label={item.name} aria-pressed={selected.id === item.id} aria-haspopup={compact ? 'dialog' : undefined}
                onClick={event => {setSelected(item); lastSelected.current = event.currentTarget; if (compact) setInfoOpen(true);}}>
                <img src={asset(`icons/${item.icon}`)} alt="" width="88" height="64" loading="lazy" decoding="async" />
              </button>)}
            </div>
          </section>)}
          {search && !filtered.some(group => group.column === column.id && group.items.length) && <p className="item-column-empty">Нет совпадений</p>}
        </div>
      </section>)}
      {!compact && <aside className="item-shop-column item-column-information" aria-label="Информация о предмете">
        <h1>ИНФОРМАЦИЯ</h1>
        <ItemInformation item={selected} />
      </aside>}
    </div>
    {compact && <dialog ref={dialog} className="item-info-dialog" aria-labelledby="item-info-title" onCancel={() => {setInfoOpen(false); lastSelected.current?.focus();}} onClick={event => {if (event.target === event.currentTarget) closeInfo();}}>
      {infoOpen && <ItemInformation item={selected} onClose={closeInfo} />}
    </dialog>}
  </main>;
}
