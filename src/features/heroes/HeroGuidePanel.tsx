import {useEffect, useState} from 'react';
import {loadGuide} from './heroLibrary';
import type {HeroDetail, HeroGuide} from './types';
import {AbilityIcon} from './HeroPage';

export function HeroGuidePanel({hero, onAbility}: {hero: HeroDetail; onAbility: (id: number) => void}) {
  const [guide, setGuide] = useState<HeroGuide>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [itemKey, setItemKey] = useState('bfury');
  const [tab, setTab] = useState<'build' | 'plan'>('build');
  const available = hero.id === 8;
  useEffect(() => {
    if (!available) return;
    const controller = new AbortController();
    setFailed(false);
    loadGuide(hero.id, controller.signal).then(setGuide).catch(() => {if (!controller.signal.aborted) setFailed(true);});
    return () => controller.abort();
  }, [hero.id, available, retry]);
  const selectedItem = guide?.itemGroups.flatMap(group => group.items).find(item => item.key === itemKey);
  return <aside className="hero-guide-panel" aria-label="Гайд и сборка">
    <header className="hero-guide-heading"><span>ГАЙД И СБОРКА</span>{guide && <b>{guide.role}</b>}</header>
    {!available ? <div className="hero-guide-empty"><h2>Выбери свой путь</h2><p>Подробный гайд для {hero.name} ещё готовится.</p>
      <p>Пока можно изучить способности и таланты или посмотреть свежие сборки:</p>
      <a href={`https://dota2protracker.com/hero/${encodeURIComponent(hero.englishName)}`} target="_blank" rel="noreferrer">Dota2ProTracker ↗</a>
      <a href={`https://www.dotabuff.com/heroes/${hero.englishName.toLowerCase().replaceAll(' ', '-')}/guides`} target="_blank" rel="noreferrer">Dotabuff ↗</a>
    </div> : !guide ? <div className="hero-guide-empty" role="status"><p>{failed ? 'Не удалось загрузить гайд.' : 'Открываем гайд…'}</p>
      {failed && <button onClick={() => setRetry(value => value + 1)}>Повторить</button>}</div> : <>
      <div className="hero-guide-tabs"><button aria-pressed={tab === 'build'} onClick={() => setTab('build')}>СБОРКА</button>
        <button aria-pressed={tab === 'plan'} onClick={() => setTab('plan')}>КАК ИГРАТЬ</button></div>
      <div className="hero-guide-content">
        <h2>{guide.title}</h2><p className="guide-summary">{guide.summary}</p>
        {tab === 'build' ? <>
          {guide.itemGroups.map(group => <section className="guide-item-group" key={group.title}><h3>{group.title}</h3>
            <div>{group.items.map(item => <button key={item.key} title={item.name} aria-label={item.name} aria-pressed={item.key === itemKey}
              onClick={() => setItemKey(item.key)}><img src={`${import.meta.env.BASE_URL}assets/item-shop/icons/${item.key}.webp`} width="64" height="48" alt="" loading="lazy" />
              {item.timing && <span>{item.timing}</span>}</button>)}</div></section>)}
          {selectedItem && <div className="guide-item-explanation" aria-live="polite"><b>{selectedItem.name}</b><p>{selectedItem.reason}</p></div>}
          <p className="guide-timing-note">Минуты — среднее время покупки в выборке, а не обязательный срок.</p>
          <section className="guide-skills"><h3>ПРОКАЧКА · ПЕРВЫЕ 10 УРОВНЕЙ</h3><div>
            {guide.skillOrder.map((key, index) => {const ability = hero.abilities.find(a => a.key === key); return ability &&
              <button key={index} onClick={() => onAbility(ability.id)} title={ability.name} aria-label={`${index + 1} уровень: ${ability.name}`}>
                <AbilityIcon ability={ability} /><span>{index + 1}</span></button>;})}</div></section>
          <section className="guide-talents"><h3>ПОПУЛЯРНЫЕ ТАЛАНТЫ</h3>{guide.talentChoices.map(key => {
            const talent = hero.talents.find(t => t.key === key);
            return talent && <p key={key}><b>{talent.level}</b><span>{talent.text}</span></p>;
          })}</section>
        </> : guide.chapters.map(chapter => <section className="guide-chapter" key={chapter.title}><h3>{chapter.title}</h3><p>{chapter.text}</p></section>)}
        <div className="guide-provenance"><a href={guide.source} target="_blank" rel="noreferrer">{guide.sourceLabel} ↗</a><p>{guide.sample}</p>
          <a href={guide.replay.url} target="_blank" rel="noreferrer">{guide.replay.label} ↗</a><p>{guide.replay.note}</p></div>
      </div>
    </>}
  </aside>;
}
