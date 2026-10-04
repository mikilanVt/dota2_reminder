import {useEffect, useRef, useState} from 'react';
import {attributeKeys, attributeNames, heroAsset, loadCatalog, loadHero} from './heroLibrary';
import type {HeroCatalog, HeroDetail} from './types';
import {HeroPage} from './HeroPage';
import './heroes.css';

const selectedFromUrl = () => Number(window.location.hash.match(/^#heroes\/(\d+)$/)?.[1]) || null;

export function HeroesScreen() {
  const [catalog, setCatalog] = useState<HeroCatalog>();
  const [selected, setSelected] = useState<number | null>(selectedFromUrl);
  const [detail, setDetail] = useState<HeroDetail>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [attack, setAttack] = useState('all');
  const [complexity, setComplexity] = useState('all');
  const returnTo = useRef<number | null>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    loadCatalog(controller.signal).then(setCatalog).catch(() => {if (!controller.signal.aborted) setError(true);});
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const onHash = () => {setSelected(selectedFromUrl()); setDetail(undefined);};
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    setDetail(undefined);
    setError(false);
    if (!selected || !catalog) return;
    if (!catalog.heroes.some(hero => hero.id === selected)) {setError(true); return;}
    const controller = new AbortController();
    loadHero(selected, controller.signal).then(data => {if (!controller.signal.aborted) setDetail(data);})
      .catch(() => {if (!controller.signal.aborted) setError(true);});
    return () => controller.abort();
  }, [selected, catalog, retry]);
  useEffect(() => {
    if (detail) title.current?.focus({preventScroll: true});
    else if (!selected && returnTo.current)
      document.getElementById(`hero-${returnTo.current}`)?.focus({preventScroll: true});
  }, [detail, selected]);

  function open(id: number | null) {
    if (id) returnTo.current = id;
    setDetail(undefined);
    setSelected(id);
    window.history.pushState(null, '', id ? `#heroes/${id}` : '#heroes');
    window.scrollTo(0, 0);
  }
  const query = search.trim().toLowerCase();
  const filtered = catalog?.heroes.filter(hero =>
    (!query || `${hero.name} ${hero.englishName} ${hero.key.replaceAll('_', ' ')}`.toLowerCase().includes(query)) &&
    (attack === 'all' || hero.attack === Number(attack)) &&
    (complexity === 'all' || hero.complexity === Number(complexity))) ?? [];

  if (selected) return <main className="heroes-screen hero-detail-screen">
    <button className="hero-back" onClick={() => open(null)}>‹ ВСЕ ГЕРОИ</button>
    {detail ? <HeroPage key={detail.id} hero={detail} titleRef={title} /> :
      <div className="hero-load" role="status"><p>{error ? 'Не удалось загрузить героя.' : 'Открываем героя…'}</p>
        {error && <button onClick={() => setRetry(value => value + 1)}>Повторить</button>}</div>}
  </main>;

  return <main className="heroes-screen">
    <div className="hero-library-toolbar">
      <h1>ГЕРОИ <span>{catalog?.heroes.length ?? ''}</span></h1>
      <div className="hero-filters">
        <label className="hero-search"><span>Поиск героя</span><input type="search" placeholder="Найти героя…" value={search}
          onChange={event => setSearch(event.target.value)} /></label>
        <label><span>Атака</span><select value={attack} onChange={event => setAttack(event.target.value)}>
          <option value="all">Любая атака</option><option value="1">Ближний бой</option><option value="2">Дальний бой</option>
        </select></label>
        <label><span>Сложность</span><select value={complexity} onChange={event => setComplexity(event.target.value)}>
          <option value="all">Любая сложность</option><option value="1">◆</option><option value="2">◆ ◆</option><option value="3">◆ ◆ ◆</option>
        </select></label>
        {(search || attack !== 'all' || complexity !== 'all') && <button className="hero-reset" onClick={() => {
          setSearch(''); setAttack('all'); setComplexity('all');
        }}>Сбросить</button>}
      </div>
    </div>
    {!catalog ? <div className="hero-load" role="status"><p>{error ? 'Не удалось открыть героев. Проверь соединение.' : 'Открываем героев…'}</p>
      {error && <button onClick={() => setRetry(value => value + 1)}>Повторить</button>}</div> :
      filtered.length ? <div className="hero-attribute-groups">
        {attributeNames.map((name, attribute) => <section className="hero-group" key={name} aria-labelledby={`attribute-${attribute}`}>
          <h2 id={`attribute-${attribute}`}><img src={heroAsset(`attributes/${attributeKeys[attribute]}.webp`)} width="26" height="26" alt="" />{name}</h2>
          <div className="hero-portraits">
            {filtered.filter(hero => hero.attribute === attribute).map(hero => <button id={`hero-${hero.id}`} key={hero.id}
              className="hero-portrait" aria-label={hero.name} title={hero.name} onClick={() => open(hero.id)}>
              <img src={heroAsset(`portraits/${hero.key}.webp`)} width="128" height="192" alt="" loading="lazy" decoding="async" />
              <span>{hero.name}</span>
            </button>)}
          </div>
        </section>)}
      </div> : <p className="hero-load" role="status">Ничего не найдено. Попробуй другое имя или сбрось фильтры.</p>}
  </main>;
}
