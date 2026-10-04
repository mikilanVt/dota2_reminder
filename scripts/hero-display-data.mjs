import {cleanItemText, itemProperties} from './item-shop-data.mjs';
import {catalogEntry} from './hero-source-data.mjs';

export const displayNumber = value => Number(value.toFixed(2)).toString().replace('.', ',');
function abilityValues(ability) {
  const values = new Map(ability.special_values.map(value => [value.name.toLowerCase(), value.values_float]));
  for (const [key, field] of Object.entries({abilitycooldown: 'cooldowns', abilitymanacost: 'mana_costs',
    abilitycastrange: 'cast_ranges', abilityduration: 'durations', abilitydamage: 'damages',
    abilitychanneltime: 'channel_times', abilitycastpoint: 'cast_points'}))
    if (!values.get(key)?.length) values.set(key, ability[field] ?? []);
  return values;
}

export function talentText(talent, abilities) {
  // A talent's generic cooldown/mana fields describe the passive talent itself
  // (usually zero), not its bonus to a hero ability. Only explicit special
  // values may override a matching named bonus on that ability.
  const own = new Map(talent.special_values.map(value => [value.name.toLowerCase(), value.values_float]));
  let unresolved = false;
  const text = talent.name_loc.replace(/\{s:([^}]+)\}/g, (_, token) => {
    const key = token.replace(/^bonus_/, '').toLowerCase();
    let numbers = own.get(key) ?? own.get(token.toLowerCase());
    if (!numbers?.length) {
      let candidates = abilities.flatMap(ability => ability.special_values
        .filter(value => value.name.toLowerCase() === key)
        .flatMap(value => value.bonuses.filter(bonus => bonus.name === talent.name).map(bonus => bonus.value)));
      // Valve sometimes renames the special value but leaves the talent token
      // unchanged. A single unambiguous bonus still identifies that talent.
      if (!candidates.length) candidates = abilities.flatMap(ability => ability.special_values
        .flatMap(value => value.bonuses.filter(bonus => bonus.name === talent.name).map(bonus => bonus.value)));
      if (candidates.length && candidates.every(value => value === candidates[0])) numbers = [candidates[0]];
    }
    if (!numbers?.length) {unresolved = true; return '…';}
    return numbers.map(displayNumber).join(' / ');
  });
  return {text: cleanItemText(text, own).content, unresolved};
}

export function abilityDescription(ability, missingImages = new Set()) {
  const values = abilityValues(ability);
  const clean = text => cleanItemText(text ?? '', values);
  const description = clean(ability.desc_loc);
  const notes = (ability.notes_loc ?? []).map(clean);
  const upgrades = [];
  for (const kind of ['scepter', 'shard']) {
    if (ability['ability_has_' + kind] && ability[kind + '_loc']) {
      const upgraded = new Map(values);
      for (const value of ability.special_values)
        if (value['values_' + kind]?.length) {
          upgraded.set(value.name.toLowerCase(), value['values_' + kind]);
          upgraded.set('bonus_' + value.name.toLowerCase(), value['values_' + kind]);
        }
      const text = cleanItemText(ability[kind + '_loc'], upgraded);
      upgrades.push({kind, text: text.content, unresolved: text.unresolved});
    }
  }
  const stats = ability.special_values.filter(value => value.heading_loc && value.values_float.length && !value.required_facet)
    .map(value => ({label: clean(value.heading_loc).content.replace(/:$/, ''),
      value: value.values_float.map(displayNumber).join(' / ') + (value.is_percentage ? '%' : '')}));
  const icon = `abilities/${ability.name}.webp`;
  return {
    id: ability.id, key: ability.name, name: ability.name_loc,
    icon: missingImages.has(icon) ? null : icon,
    innate: ability.ability_is_innate, ultimate: ability.type === 1,
    grantedBy: ability.ability_is_granted_by_scepter ? 'scepter' : ability.ability_is_granted_by_shard ? 'shard' : null,
    passive: (BigInt(ability.behavior) & 2n) !== 0n,
    description: description.content, notes: notes.map(note => note.content),
    properties: itemProperties(ability), stats, mana: ability.mana_costs, cooldown: ability.cooldowns,
    range: ability.cast_ranges, upgrades,
    unresolved: description.unresolved || notes.some(note => note.unresolved)
  };
}

export function heroDescription(hero, metadata, missingImages = new Set()) {
  // Valve's website adds universal damage here; other damage_min/max already
  // include the primary attribute. Do not add STR/AGI/INT a second time.
  const universal = hero.primary_attr === 3 ? Math.floor(0.45 * Math.floor(hero.str_base + hero.agi_base + hero.int_base)) : 0;
  const key = catalogEntry(hero).key;
  return {
    ...catalogEntry(hero), ...metadata, attack: hero.attack_capability,
    art: missingImages.has(`art/${key}.webp`) ? null : `art/${key}.webp`,
    introduction: cleanItemText(hero.hype_loc, new Map()).content,
    tagline: hero.npe_desc_loc, biography: cleanItemText(hero.bio_loc, new Map()).content,
    attributes: [[hero.str_base, hero.str_gain], [hero.agi_base, hero.agi_gain], [hero.int_base, hero.int_gain]],
    stats: {
      damage: [hero.damage_min + universal, hero.damage_max + universal],
      armor: hero.armor, speed: hero.movement_speed, attackTime: hero.attack_rate, range: hero.attack_range,
      health: hero.max_health, healthRegen: hero.health_regen, mana: hero.max_mana, manaRegen: hero.mana_regen,
      magicResistance: hero.magic_resistance, vision: [hero.sight_range_day, hero.sight_range_night]
    },
    abilities: hero.abilities.map(ability => abilityDescription(ability, missingImages)),
    talents: hero.talents.map((talent, i) => ({id: talent.id, key: talent.name,
      level: 10 + Math.floor(i / 2) * 5, ...talentText(talent, hero.abilities)}))
  };
}
