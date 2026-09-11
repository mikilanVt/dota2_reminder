import {useEffect, useRef, useState} from 'react';
import {asset, groups, itemById, snapshotDate} from './itemShop';
import {EmptyInformation, ItemInformation} from './ItemInformation';
import type {ShopItem} from './types';
import './items.css';

const columns = [
  {id: 'basic', title: 'ОСНОВНЫЕ'},
  {id: 'upgrades', title: 'УЛУЧШЕНИЯ'},
  {id: 'neutral', title: 'НЕЙТРАЛЬНЫЕ ПРЕДМЕТЫ'}
] as const;
const normalize = (value: string) => value.toLowerCase().replaceAll('ё', 'е').replaceAll('_', ' ').trim();

export function ItemsScreen() {
  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [history, setHistory] = useState<number[]>([]);
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
    const update = () => {setCompact(media.matches); if (!media.matches) setInfoOpen(false);};
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

  function selectRelated(id: number) {
    const next = itemById.get(id);
    if (!next || next.id === selected?.id) return;
    if (selected) setHistory(current => [...current, selected.id].slice(-12));
    setSelected(next);
  }

  function goBack() {
    const previous = itemById.get(history[history.length - 1]);
    if (previous) setSelected(previous);
    setHistory(current => current.slice(0, -1));
  }

  return <main className="items-screen">
    <div className="item-shop-toolbar">
      <label className="item-search"><span>Поиск предмета</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Название предмета…" autoComplete="off" /></label>
      <p className="item-shop-version">{search ? `Найдено: ${found}` : `Каталог от ${snapshotDate.split('-').reverse().join('.')}`}</p>
    </div>
    <div className="item-shop-grid">
      {columns.map(column => <section key={column.id} className={`item-shop-column item-column-${column.id}`} aria-labelledby={`item-column-title-${column.id}`}>
        <h1 id={`item-column-title-${column.id}`}>{column.title}</h1>
        <div className="item-shop-surface">
          {filtered.filter(group => group.column === column.id).map(group => <section className={`item-group item-group-${group.id}${!group.items.length ? ' is-empty' : ''}`} key={group.id}>
            <h2><span>{group.title}</span>{group.unlockTime && <span className="neutral-unlock" title="Время доступа к предметам разряда"><span aria-hidden="true">◷ </span>{group.unlockTime}+</span>}</h2>
            <div className="item-icon-grid">
              {group.items.map(item => <button className={`item-tile${selected?.id === item.id ? ' is-selected' : ''}`} type="button" key={item.id}
                title={item.name} aria-label={item.name} aria-pressed={selected?.id === item.id} aria-haspopup={compact ? 'dialog' : undefined}
                onClick={event => {setSelected(item); setHistory([]); lastSelected.current = event.currentTarget; if (compact) setInfoOpen(true);}}>
                <img src={asset(`icons/${item.icon}`)} alt="" width="88" height="64" loading="lazy" decoding="async" />
              </button>)}
            </div>
          </section>)}
          {column.id === 'basic' && !search && <img className="shopkeeper-art" src={asset('shopkeeper.webp')} alt="" width="265" height="420" loading="lazy" decoding="async" />}
          {search && !filtered.some(group => group.column === column.id && group.items.length) && <p className="item-column-empty">Нет совпадений</p>}
        </div>
      </section>)}
      {!compact && <aside className="item-shop-column item-column-information" aria-label="Информация о предмете">
        <h1>ИНФОРМАЦИЯ</h1>
        {selected ? <ItemInformation item={selected} onSelect={selectRelated} onBack={history.length ? goBack : undefined} /> : <EmptyInformation />}
      </aside>}
    </div>
    {compact && <dialog ref={dialog} className="item-info-dialog" aria-labelledby="item-info-title" onCancel={() => {setInfoOpen(false); lastSelected.current?.focus();}} onClick={event => {if (event.target === event.currentTarget) closeInfo();}}>
      {infoOpen && selected && <ItemInformation item={selected} onSelect={selectRelated} onBack={history.length ? goBack : undefined} onClose={closeInfo} />}
    </dialog>}
  </main>;
}
