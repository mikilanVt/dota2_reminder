import {useState, type RefObject} from 'react';
import {attributeKeys, attributeNames, heroAsset, levels, number} from './heroLibrary';
import type {HeroAbility, HeroDetail} from './types';
import {HeroGuidePanel} from './HeroGuidePanel';

export function AbilityIcon({ability}: {ability: HeroAbility}) {
  return ability.icon ? <img src={heroAsset(ability.icon)} width="64" height="64" alt="" decoding="async" /> :
    <span className="ability-icon-fallback" aria-hidden="true">{ability.name.slice(0, 2).toUpperCase()}</span>;
}

function AbilityInformation({ability}: {ability: HeroAbility}) {
  return <section className={`hero-ability-info${ability.passive ? ' is-passive' : ''}`} aria-label={ability.name}>
    <header><AbilityIcon ability={ability} /><div><span>{ability.innate ? 'ВРОЖДЁННАЯ' : ability.ultimate ? 'УЛЬТИМЕЙТ' : ability.passive ? 'ПАССИВНАЯ' : 'СПОСОБНОСТЬ'}</span>
      <h3>{ability.name}</h3></div></header>
    <div className="hero-ability-properties">{ability.properties.map(property => <div key={property.label}>
      {property.label}: <span>{property.value}</span></div>)}</div>
    <p>{ability.description}</p>
    {ability.unresolved && <p className="hero-data-note">Некоторые значения в описании ещё уточняются.</p>}
    <dl className="hero-ability-values">{ability.stats.map((stat, i) => <div key={i}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
    <div className="hero-ability-costs">
      {ability.mana.some(Boolean) && <span title="Расход маны"><i className="mana-square" /> МАНА <b>{levels(ability.mana)}</b></span>}
      {ability.cooldown.some(Boolean) && <span title="Перезарядка"><i className="cooldown-square" /> ПЕРЕЗАРЯДКА <b>{levels(ability.cooldown)} с</b></span>}
      {ability.range.some(Boolean) && <span>ДАЛЬНОСТЬ <b>{levels(ability.range)}</b></span>}
    </div>
    {ability.upgrades.map(upgrade => <div className="hero-upgrade" key={upgrade.kind}><h4>Aghanim’s {upgrade.kind === 'scepter' ? 'Scepter' : 'Shard'}</h4>
      <p>{upgrade.text}</p>{upgrade.unresolved && <small>Часть значений уточняется.</small>}</div>)}
    {ability.notes.length > 0 && <details className="hero-notes"><summary>Подробности механики</summary>
      {ability.notes.map((note, index) => <p key={index}>{note}</p>)}</details>}
  </section>;
}

export function HeroPage({hero, titleRef}: {hero: HeroDetail; titleRef: RefObject<HTMLHeadingElement | null>}) {
  const [abilityId, setAbilityId] = useState(hero.abilities.find(a => !a.innate && !a.grantedBy)?.id ?? hero.abilities[0].id);
  const [tab, setTab] = useState<'abilities' | 'talents' | 'story'>('abilities');
  const ability = hero.abilities.find(a => a.id === abilityId)!;
  const s = hero.stats;
  return <div className="hero-detail-grid">
    <section className="hero-overview">
      {hero.art && <img className="hero-large-art" src={heroAsset(hero.art)} width="800" height="800" alt={hero.name} decoding="async" />}
      <div className="hero-identity">
        <div className="hero-attribute-label"><img src={heroAsset(`attributes/${attributeKeys[hero.attribute]}.webp`)} width="28" height="28" alt="" />
          {attributeNames[hero.attribute]}</div>
        <h1 ref={titleRef} tabIndex={-1}>{hero.name}</h1>
        <p className="hero-tagline">{hero.tagline}</p>
        <div className="hero-meta"><span aria-label={`Сложность: ${hero.complexity} из 3`} title="Сложность">
          {[1, 2, 3].map(level => <i key={level} className={level <= hero.complexity ? 'filled' : ''}>◆</i>)}</span>
          <span>{hero.attack === 1 ? 'БЛИЖНИЙ БОЙ' : 'ДАЛЬНИЙ БОЙ'}</span></div>
      </div>
      <div className="hero-base-stats">
        <span className="hero-level-label">ХАРАКТЕРИСТИКИ · 1 УРОВЕНЬ</span>
        <div className="hero-stat-layout">
          <dl className="hero-attributes">{hero.attributes.map(([base, gain], index) => <div key={index}>
            <dt>{attributeNames[index]}</dt><dd><img src={heroAsset(`attributes/${attributeKeys[index]}.webp`)} width="22" height="22" alt="" />
              {number(base)} <span>+ {number(gain)}</span></dd></div>)}</dl>
          <div className="hero-combat-stats">
            <dl>{[['Урон', s.damage.map(number).join('–')], ['Броня', number(s.armor)], ['Скорость', number(s.speed)],
              ['Интервал атаки', number(s.attackTime) + ' с'], ['Дальность', number(s.range)], ['Сопр. магии', number(s.magicResistance) + '%']]
              .map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <div className="hero-vital health"><span>ЗДОРОВЬЕ</span><b>{number(s.health)}</b><small>+{number(s.healthRegen)}</small></div>
            <div className="hero-vital mana"><span>МАНА</span><b>{number(s.mana)}</b><small>+{number(s.manaRegen)}</small></div>
          </div>
        </div>
      </div>
      <div className="hero-spell-strip" aria-label="Способности героя">{hero.abilities.map(a => <button key={a.id} title={a.name}
        aria-label={a.name} aria-pressed={tab === 'abilities' && a.id === abilityId}
        className={`${a.innate ? 'is-innate ' : ''}${a.grantedBy ? 'is-upgrade' : ''}`}
        onClick={() => {setAbilityId(a.id); setTab('abilities');}}><AbilityIcon ability={a} />
        {a.grantedBy && <small>{a.grantedBy === 'scepter' ? 'S' : '✦'}</small>}</button>)}</div>
    </section>
    <HeroGuidePanel hero={hero} onAbility={id => {setAbilityId(id); setTab('abilities');}} />
    <div className="hero-reference">
      <div className="hero-detail-tabs" aria-label="Информация о герое">
        {([['abilities', 'СПОСОБНОСТИ'], ['talents', 'ТАЛАНТЫ'], ['story', 'О ГЕРОЕ']] as const).map(([id, label]) =>
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        <span>{hero.patch}</span>
      </div>
      {tab === 'abilities' ? <AbilityInformation ability={ability} /> : tab === 'talents' ?
        <section className="hero-talent-tree" aria-label="Древо талантов">
          {[25, 20, 15, 10].map(level => <div className="hero-talent-row" key={level}>
            <p>{hero.talents.find(t => t.level === level)?.text ?? 'Уточняется'}</p><b>{level}</b>
            <p>{hero.talents.filter(t => t.level === level)[1]?.text ?? 'Уточняется'}</p>
          </div>)}
        </section> : <section className="hero-story"><p>{hero.introduction}</p><p>{hero.biography}</p></section>}
    </div>
  </div>;
}
