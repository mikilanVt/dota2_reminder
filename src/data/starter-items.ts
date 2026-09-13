import type {GameEntity, GameFact, QuestionBank, Verification} from './types.js';

const verification: Verification = {
  patch: '7.41e', checkedAt: '2026-09-09', status: 'verified'
};

function item(id: string, valveId: number, name: string, aliases: string[], values: Record<string, number>): GameEntity {
  return {
    id, valveId, name, aliases, values, topic: 'items', verification,
    source: {
      title: `${name} — данные Valve`,
      url: `https://www.dota2.com/datafeed/itemdata?language=english&item_id=${valveId}`,
      retrievedAt: '2026-09-09'
    }
  };
}

// Numbers are transcribed from Valve's special_values. The dated numeric
// snapshot is kept in data-sources/ and is not shipped to the browser.
const fire = item('item_faerie_fire', 237, 'Faerie Fire', ['фейри', 'огонёк'], {hp_restore: 85, bonus_damage: 2});
const branch = item('item_branches', 16, 'Iron Branch', ['ветка', 'айрон бранч'], {bonus_all_stats: 1, tree_duration: 20});
const clarity = item('item_clarity', 38, 'Clarity', ['кларити'], {mana_regen: 6, buff_duration: 25});
const mango = item('item_enchanted_mango', 216, 'Enchanted Mango', ['манго'], {replenish_amount: 100});
const salve = item('item_flask', 39, 'Healing Salve', ['фласка', 'салва'], {health_regen: 30, buff_duration: 13});
const bottle = item('item_bottle', 41, 'Bottle', ['бутылка', 'ботл'], {health_restore: 110, mana_restore: 60, restore_time: 2.7});
const tango = item('item_tango', 44, 'Tango', ['танго'], {health_regen: 7, buff_duration: 16});

function fact(entity: GameEntity, key: string, value: number, unit: string, conditions: string, explanation: string, evidence: string[]): GameFact {
  return {
    id: `${entity.id}.${key}`, entityId: entity.id, topic: entity.topic,
    value, unit, conditions, explanation, evidence,
    source: entity.source, verification: entity.verification
  };
}

const facts: GameFact[] = [
  fact(fire, 'heal', fire.values.hp_restore, 'здоровья', 'Использование на себя. Без усиления или снижения лечения.',
    `Faerie Fire мгновенно восстанавливает ${fire.values.hp_restore} здоровья. Это активное использование расходует предмет.`, ['special_values.hp_restore']),
  fact(fire, 'damage', fire.values.bonus_damage, 'урона', 'Предмет находится в активном инвентаре и ещё не использован.',
    `Пассивный бонус Faerie Fire — ${fire.values.bonus_damage} к урону от атак. Это отдельный эффект от мгновенного восстановления здоровья.`, ['special_values.bonus_damage']),
  fact(branch, 'attributes', branch.values.bonus_all_stats, 'к каждому атрибуту', 'Одна Iron Branch находится в активном инвентаре.',
    `Одна ветка даёт +${branch.values.bonus_all_stats} к силе, ловкости и интеллекту.`, ['special_values.bonus_all_stats']),
  fact(branch, 'tree-duration', branch.values.tree_duration, 'сек.', 'Дерево посажено Iron Branch и не уничтожено раньше времени.',
    `Посаженное дерево существует ${branch.values.tree_duration} секунд. Это время жизни дерева, а не длительность восстановления от Tango.`, ['special_values.tree_duration']),
  fact(clarity, 'duration', clarity.values.buff_duration, 'сек.', 'Эффект не прерван до завершения.',
    `Clarity даёт ${clarity.values.mana_regen} маны в секунду в течение ${clarity.values.buff_duration} секунд.`, ['special_values.buff_duration', 'special_values.mana_regen']),
  fact(clarity, 'mana-total', clarity.values.mana_regen * clarity.values.buff_duration, 'маны', 'Эффект действует полностью. Без усиления восстановления; собственной регенерацией героя пренебрегаем.',
    `${clarity.values.mana_regen} маны/сек. × ${clarity.values.buff_duration} сек. = ${clarity.values.mana_regen * clarity.values.buff_duration} маны от самого предмета.`, ['special_values.mana_regen', 'special_values.buff_duration']),
  fact(mango, 'mana', mango.values.replenish_amount, 'маны', 'Одно использование на себя, без усиления восстановления.',
    `Enchanted Mango мгновенно восстанавливает ${mango.values.replenish_amount} маны.`, ['special_values.replenish_amount']),
  fact(salve, 'self-heal', salve.values.health_regen * salve.values.buff_duration, 'здоровья', 'Применение на себя. Эффект не прерван, усиление лечения и собственная регенерация не учитываются.',
    `${salve.values.health_regen} здоровья/сек. × ${salve.values.buff_duration} сек. = ${salve.values.health_regen * salve.values.buff_duration} здоровья от Healing Salve.`, ['special_values.health_regen', 'special_values.buff_duration']),
  fact(salve, 'ally-heal', salve.values.health_regen * salve.values.buff_duration / 2, 'здоровья', 'Применение на союзного героя. Эффект действует полностью, без модификаторов лечения и собственной регенерации.',
    `На союзнике Healing Salve восстанавливает вдвое меньше здоровья в секунду: ${salve.values.health_regen / 2} × ${salve.values.buff_duration} = ${salve.values.health_regen * salve.values.buff_duration / 2}.`, ['special_values.health_regen', 'special_values.buff_duration', 'desc_loc: heals half the amount per second on an ally']),
  fact(bottle, 'health', bottle.values.health_restore, 'здоровья', 'Один заряд на себя. Эффект не прерван; без усиления лечения и собственной регенерации.',
    `Один заряд Bottle восстанавливает ${bottle.values.health_restore} здоровья и ${bottle.values.mana_restore} маны за ${String(bottle.values.restore_time).replace('.', ',')} секунды.`, ['special_values.health_restore', 'special_values.mana_restore', 'special_values.restore_time']),
  fact(bottle, 'mana', bottle.values.mana_restore, 'маны', 'Один заряд на себя. Эффект не прерван; без усиления восстановления и собственной регенерации.',
    `Восстановление маны за один заряд — ${bottle.values.mana_restore}. Здоровье и мана восстанавливаются одновременно.`, ['special_values.mana_restore']),
  fact(tango, 'duration', tango.values.buff_duration, 'сек.', 'Своё Tango применено на обычное дерево.',
    `От обычного дерева восстановление длится ${tango.values.buff_duration} секунд. Дерево от Iron Branch удваивает эту длительность.`, ['special_values.buff_duration', 'desc_loc: Ironwood Tree doubles the heal duration']),
  fact(tango, 'branch-duration', tango.values.buff_duration * 2, 'сек.', 'Своё Tango применено на дерево, посаженное Iron Branch.',
    `Длительность удваивается: ${tango.values.buff_duration} × 2 = ${tango.values.buff_duration * 2} секунды. Удваивается время восстановления, а не его скорость.`, ['special_values.buff_duration', 'desc_loc: Ironwood Tree doubles the heal duration']),
  fact(tango, 'heal-total', tango.values.health_regen * tango.values.buff_duration, 'здоровья', 'Своё Tango, обычное дерево, полная длительность. Без усиления лечения и собственной регенерации героя.',
    `${tango.values.health_regen} здоровья/сек. × ${tango.values.buff_duration} сек. = ${tango.values.health_regen * tango.values.buff_duration} здоровья от Tango.`, ['special_values.health_regen', 'special_values.buff_duration'])
];

export const starterItems: QuestionBank = {
  id: 'starter-items-7.41e-v1', patch: verification.patch,
  entities: [fire, branch, clarity, mango, salve, bottle, tango], facts,
  questions: [
    {id: 'fire-heal', factId: 'item_faerie_fire.heal', prompt: 'Сколько здоровья мгновенно восстанавливает Faerie Fire?', distractors: [50, 75, 100]},
    {id: 'fire-damage', factId: 'item_faerie_fire.damage', prompt: 'Сколько урона от атак даёт Faerie Fire, пока лежит в инвентаре?', distractors: [1, 3, 5]},
    {id: 'branch-attributes', factId: 'item_branches.attributes', prompt: 'Какой бонус к атрибутам даёт одна Iron Branch?', distractors: [2, 3, 5]},
    {id: 'branch-tree', factId: 'item_branches.tree-duration', prompt: 'Сколько существует дерево, посаженное Iron Branch?', distractors: [10, 16, 30]},
    {id: 'clarity-duration', factId: 'item_clarity.duration', prompt: 'Сколько длится восстановление маны от Clarity?', distractors: [15, 20, 30]},
    {id: 'clarity-mana', factId: 'item_clarity.mana-total', prompt: 'Сколько маны суммарно восстанавливает Clarity за полную длительность?', distractors: [100, 125, 175]},
    {id: 'mango-mana', factId: 'item_enchanted_mango.mana', prompt: 'Сколько маны мгновенно восстанавливает Enchanted Mango?', distractors: [60, 75, 125]},
    {id: 'salve-self', factId: 'item_flask.self-heal', prompt: 'Сколько здоровья суммарно восстановит Healing Salve при применении на себя?', distractors: [300, 400, 450]},
    {id: 'salve-ally', factId: 'item_flask.ally-heal', prompt: 'Сколько здоровья суммарно восстановит Healing Salve союзному герою?', distractors: [130, 260, 390]},
    {id: 'bottle-health', factId: 'item_bottle.health', prompt: 'Сколько здоровья восстанавливает один заряд Bottle?', distractors: [85, 100, 125]},
    {id: 'bottle-mana', factId: 'item_bottle.mana', prompt: 'Сколько маны восстанавливает один заряд Bottle?', distractors: [50, 75, 100]},
    {id: 'tango-duration', factId: 'item_tango.duration', prompt: 'Сколько длится восстановление от Tango после обычного дерева?', distractors: [10, 12, 20]},
    {id: 'tango-branch', factId: 'item_tango.branch-duration', prompt: 'Сколько длится Tango после дерева, посаженного Iron Branch?', distractors: [16, 20, 24]},
    {id: 'tango-heal', factId: 'item_tango.heal-total', prompt: 'Сколько здоровья суммарно восстанавливает Tango после обычного дерева?', distractors: [90, 115, 140]}
  ]
};
