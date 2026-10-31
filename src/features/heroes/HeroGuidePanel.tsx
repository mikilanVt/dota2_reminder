import {useEffect, useState} from 'react';
import {loadGuide} from './heroLibrary';
import type {HeroDetail, HeroGuide} from './types';
import {AbilityIcon} from './HeroPage';

export function HeroGuidePanel({hero, onAbility, onTalent}: {hero: HeroDetail; onAbility: (id: number) => void; onTalent: () => void}) {
  const [loaded, setGuide] = useState<HeroGuide>();
  const guide = loaded?.heroId === hero.id ? loaded : undefined;
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [itemKey, setItemKey] = useState('');
  const [tab, setTab] = useState<'build' | 'plan'>('build');
  useEffect(() => {
    const controller = new AbortController();
    setGuide(undefined);
    setItemKey('');
    setTab('build');
    setFailed(false);
    loadGuide(hero.id, controller.signal).then(value => {if (!controller.signal.aborted) setGuide(value);})
      .catch(() => {if (!controller.signal.aborted) setFailed(true);});
    return () => controller.abort();
  }, [hero.id, retry]);
  const items = guide?.itemGroups.flatMap((group, index) => group.items.map(item => ({...item, selection: `${index}/${item.key}`}))) ?? [];
  const selectedItem = items.find(item => item.selection === itemKey) ?? items[0];
  return <aside className="hero-guide-panel" aria-label="Гайд и сборка">
    <header className="hero-guide-heading"><span>ГАЙД И СБОРКА</span>{guide && <b>{guide.role}</b>}</header>
    {!guide ? <div className="hero-guide-empty" role="status"><p>{failed ? 'Не удалось загрузить гайд.' : 'Открываем гайд…'}</p>
      {failed && <button onClick={() => setRetry(value => value + 1)}>Повторить</button>}</div> : <>
      <div className="hero-guide-tabs"><button aria-pressed={tab === 'build'} onClick={() => setTab('build')}>СБОРКА</button>
        <button aria-pressed={tab === 'plan'} onClick={() => setTab('plan')}>КАК ИГРАТЬ</button></div>
      <div className="hero-guide-content">
        <h2>{guide.title}</h2><p className="guide-summary">{guide.summary}</p>
        {tab === 'build' ? <>
          {guide.itemGroups.map((group, groupIndex) => <section className="guide-item-group" key={group.title}><h3>{group.title}</h3>
            <div>{group.items.map(item => <button key={item.key} title={item.name} aria-label={`${item.name}${item.quantity ? `, ${item.quantity} шт.` : ''}`}
              aria-pressed={`${groupIndex}/${item.key}` === selectedItem?.selection} onClick={() => setItemKey(`${groupIndex}/${item.key}`)}>
              <img src={`${import.meta.env.BASE_URL}assets/item-shop/icons/${item.icon ?? item.key}.webp`} width="64" height="48" alt="" loading="lazy" />
              {item.quantity && <b className="guide-item-quantity">×{item.quantity}</b>}
              {item.timing && <span>{item.timing}</span>}</button>)}</div>
            {group.note && <p className="guide-timing-note">{group.note}</p>}</section>)}
          {selectedItem && <div className="guide-item-explanation" aria-live="polite"><b>{selectedItem.name}</b>
            {selectedItem.charges && <span> · {selectedItem.charges} зар.</span>}
            {selectedItem.purchaseRate !== undefined && <span> · в {selectedItem.purchaseRate}% матчей сборки</span>}
            <p>{selectedItem.reason}</p></div>}
          <p className="guide-timing-note">Минуты показывают среднее время покупки в выборке. Это ориентир, а не обязательный срок. Ситуативные предметы не нужно покупать все подряд.</p>
          <section className="guide-skills"><h3>ПРОКАЧКА · ПЕРВЫЕ 10 УРОВНЕЙ</h3><div>
            {guide.skillOrder.map((key, index) => {const ability = hero.abilities.find(a => a.key === key);
              const talent = hero.talents.find(t => t.key === key);
              const label = ability?.name ?? talent?.text ?? 'Бонус ко всем атрибутам';
              return <button key={index} onClick={() => {if (ability) onAbility(ability.id); else if (talent) onTalent();}}
                disabled={!ability && !talent} title={label}
                aria-label={`${index + 1} уровень: ${label}`}>
                {ability ? <AbilityIcon ability={ability} /> : <b className="guide-skill-bonus">{talent ? '✦' : '+'}</b>}
                <span>{index + 1}</span></button>;})}</div><p className="guide-timing-note">{guide.skillSample}</p></section>
          <section className="guide-talents"><h3>ПОПУЛЯРНЫЕ ТАЛАНТЫ</h3>{guide.talentChoices.map(key => {
            const talent = hero.talents.find(t => t.key === key);
            return talent && <p key={key}><b>{talent.level}</b><span>{guide.talentLabels?.[key] ?? talent.text}</span><small title="Частота выбора">{guide.talentPickRates[key]}%</small></p>;
          })}</section>
        </> : guide.chapters.map(chapter => <section className="guide-chapter" key={chapter.title}><h3>{chapter.title}</h3><p>{chapter.text}</p></section>)}
        <details className="guide-provenance"><summary>СБОРКИ И ПРИМЕРЫ МАТЧЕЙ · {guide.patch}</summary>
          <a href={guide.source} target="_blank" rel="noreferrer">{guide.sourceLabel} ↗</a><p>{guide.sample}</p>
          <a href={guide.replay.url} target="_blank" rel="noreferrer">{guide.replay.label} ↗</a><p>{guide.replay.note}</p></details>
      </div>
    </>}
  </aside>;
}
