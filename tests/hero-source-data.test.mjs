import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHeroList, parseHeroResponse, catalogEntry} from '../scripts/hero-source-data.mjs';

// Synthetic schema fixture; it is not a gameplay-data source.
const identity = {id: 8, name: 'npc_dota_hero_juggernaut', name_loc: 'Juggernaut',
  name_english_loc: 'Juggernaut', primary_attr: 1, complexity: 1};
const wrap = heroes => JSON.stringify({result: {data: {heroes}}});
function fixture() {
  return {...identity, str_base: 20, str_gain: 2, agi_base: 32, agi_gain: 2.8,
    int_base: 14, int_gain: 1.4, damage_min: 54, damage_max: 56, attack_rate: 1.4,
    attack_range: 150, armor: 5.3333335, movement_speed: 305, max_health: 560,
    health_regen: 2.5, max_mana: 243, mana_regen: 0.7, attack_capability: 1,
    role_levels: [2, 0, 0, 0, 0, 0, 1, 1, 0],
    abilities: [{id: 5028, name: 'juggernaut_blade_fury', name_loc: 'Blade Fury',
      desc_loc: 'Synthetic %test_value% text.', special_values: [], mana_costs: [110], cooldowns: [30, 26, 22, 18], cast_ranges: [0]}]};
}
test('rejects an error response, duplicate identities and unsafe asset keys', () => {
  assert.throws(() => parseHeroList('{"result":{"status":2}}'));
  assert.throws(() => parseHeroList(wrap([identity, identity])), /Duplicate/);
  assert.throws(() => parseHeroList(wrap([{...identity, name: '../file'}])), /key/);
  assert.throws(() => parseHeroList(wrap([{...identity, primary_attr: 4}])), /attribute/);
  assert.equal(parseHeroList(wrap([identity])).length, 1);
});
test('stops import when the detail belongs to another hero or snapshot', () => {
  const hero = fixture();
  assert.throws(() => parseHeroResponse(wrap([{...hero, id: 18}]), identity), /match request/);
  assert.throws(() => parseHeroResponse(wrap([{...hero, primary_attr: 3}]), identity), /refresh/);
  assert.throws(() => parseHeroResponse(wrap([hero, hero]), identity), /exactly one/);
});
test('preserves numerical precision, level arrays and unresolved source text', () => {
  const hero = fixture();
  const result = parseHeroResponse(wrap([hero]), identity);
  assert.equal(result.armor, hero.armor);
  assert.deepEqual(result.abilities[0].cooldowns, [30, 26, 22, 18]);
  assert.equal(result.abilities[0].desc_loc, 'Synthetic %test_value% text.');
  assert.throws(() => parseHeroResponse(wrap([{...hero, max_mana: null}]), identity), /max_mana/);
  assert.throws(() => parseHeroResponse(wrap([{...hero, abilities: [hero.abilities[0], hero.abilities[0]]}]), identity), /duplicate/);
});
test('keeps the navigation catalog free of the complete ability and source payload', () => {
  const result = catalogEntry(fixture());
  assert.deepEqual(result, {id: 8, key: 'juggernaut', name: 'Juggernaut',
    englishName: 'Juggernaut', attribute: 1, complexity: 1});
  const universal = {...identity, id: 3, name: 'npc_dota_hero_bane', primary_attr: 3};
  assert.equal(catalogEntry(universal).attribute, 3);
});
