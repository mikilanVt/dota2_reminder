// Validate Valve's source schema without silently inventing game rules or values.
const prefix = 'npc_dota_hero_';
function check(condition, message) {
  if (!condition) throw new Error(message);
}
function heroIdentity(hero) {
  check(hero && typeof hero === 'object', 'Hero must be an object');
  check(Number.isSafeInteger(hero.id) && hero.id > 0, 'Invalid hero ID');
  check(typeof hero.name === 'string' && /^npc_dota_hero_[a-z0-9_]+$/.test(hero.name), 'Invalid hero key');
  check(typeof hero.name_loc === 'string' && hero.name_loc.trim(), 'Missing hero name');
  check([0, 1, 2, 3].includes(hero.primary_attr), 'Unknown hero attribute');
  check([1, 2, 3].includes(hero.complexity), 'Unknown hero complexity');
}
function responseHeroes(raw) {
  const heroes = JSON.parse(raw)?.result?.data?.heroes;
  check(Array.isArray(heroes) && heroes.length > 0, 'Missing Valve heroes response');
  return heroes;
}
export function parseHeroList(raw) {
  const heroes = responseHeroes(raw);
  const ids = new Set();
  const keys = new Set();
  for (const hero of heroes) {
    heroIdentity(hero);
    check(!ids.has(hero.id) && !keys.has(hero.name), 'Duplicate hero in list');
    ids.add(hero.id);
    keys.add(hero.name);
  }
  return heroes;
}
export function parseHeroResponse(raw, expected) {
  const heroes = responseHeroes(raw);
  check(heroes.length === 1, 'Expected exactly one hero');
  const hero = heroes[0];
  heroIdentity(hero);
  check(hero.id === expected.id && hero.name === expected.name, 'Hero response does not match request');
  check(hero.primary_attr === expected.primary_attr && hero.complexity === expected.complexity,
    'Hero list and detail differ; refresh the complete snapshot');
  for (const field of ['str_base', 'str_gain', 'agi_base', 'agi_gain', 'int_base', 'int_gain',
    'damage_min', 'damage_max', 'attack_rate', 'attack_range', 'armor', 'movement_speed',
    'max_health', 'health_regen', 'max_mana', 'mana_regen'])
    check(typeof hero[field] === 'number' && Number.isFinite(hero[field]), 'Missing numeric field: ' + field);
  check(Array.isArray(hero.role_levels) && hero.role_levels.length === 9, 'Unexpected hero roles');
  check(hero.role_levels.every(value => Number.isInteger(value) && value >= 0 && value <= 3), 'Invalid role level');
  check([1, 2].includes(hero.attack_capability), 'Unknown attack capability');
  check(Array.isArray(hero.abilities) && hero.abilities.length > 0, 'Missing hero abilities');
  const abilityIds = new Set();
  for (const ability of hero.abilities) {
    check(Number.isSafeInteger(ability.id) && ability.id > 0 && !abilityIds.has(ability.id), 'Invalid or duplicate ability ID');
    check(typeof ability.name === 'string' && /^[a-z0-9_]+$/.test(ability.name), 'Invalid ability key');
    check(typeof ability.name_loc === 'string' && typeof ability.desc_loc === 'string', 'Missing ability text');
    check(Array.isArray(ability.special_values), 'Missing ability values');
    for (const field of ['mana_costs', 'cooldowns', 'cast_ranges'])
      check(Array.isArray(ability[field]) && ability[field].every(Number.isFinite), 'Invalid ability field: ' + field);
    abilityIds.add(ability.id);
  }
  return hero;
}
export function catalogEntry(hero) {
  heroIdentity(hero);
  return {
    id: hero.id, key: hero.name.slice(prefix.length), name: hero.name_loc,
    englishName: hero.name_english_loc || hero.name_loc,
    attribute: hero.primary_attr, complexity: hero.complexity
  };
}
