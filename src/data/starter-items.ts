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

// Numbers are transcribed from Valve's item data. The dated source snapshots
// are kept in data-sources/ and detailed imported cards live in public/assets/item-shop/details/.
const fire = item('item_faerie_fire', 237, 'Faerie Fire', ['фейри', 'огонёк'], {hp_restore: 85, bonus_damage: 2});
const branch = item('item_branches', 16, 'Iron Branch', ['ветка', 'айрон бранч'], {bonus_all_stats: 1, tree_duration: 20});
const clarity = item('item_clarity', 38, 'Clarity', ['кларити'], {mana_regen: 6, buff_duration: 25});
const mango = item('item_enchanted_mango', 216, 'Enchanted Mango', ['манго'], {replenish_amount: 100});
const salve = item('item_flask', 39, 'Healing Salve', ['фласка', 'салва'], {health_regen: 30, buff_duration: 13});
const bottle = item('item_bottle', 41, 'Bottle', ['бутылка', 'ботл'], {health_restore: 110, mana_restore: 60, restore_time: 2.7});
const tango = item('item_tango', 44, 'Tango', ['танго'], {health_regen: 7, buff_duration: 16});
const stick = item('item_magic_stick', 34, 'Magic Stick', ['стик', 'magic stick'], {restore_per_charge: 15, max_charges: 10, charge_radius: 1200, cooldown: 17});
const wand = item('item_magic_wand', 36, 'Magic Wand', ['ванд', 'magic wand'], {restore_per_charge: 15, max_charges: 20, bonus_all_stats: 3, charge_radius: 1200, cooldown: 15});
const treads = item('item_power_treads', 63, 'Power Treads', ['пт', 'треды'], {bonus_attribute: 10, attack_speed: 25, ranged_move_speed: 45, melee_move_speed: 55});
const blink = item('item_blink', 1, 'Blink Dagger', ['блинк', 'даггер'], {blink_range: 1200, damage_lockout: 3, cooldown: 15});
const bkb = item('item_black_king_bar', 116, 'Black King Bar', ['бкб', 'bkb'], {magic_resistance: 60, first_duration: 9, minimum_duration: 7, mana_cost: 50, cooldown: 95, bonus_strength: 10, bonus_damage: 24});

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
    `${tango.values.health_regen} здоровья/сек. × ${tango.values.buff_duration} сек. = ${tango.values.health_regen * tango.values.buff_duration} здоровья от Tango.`, ['special_values.health_regen', 'special_values.buff_duration']),

  fact(stick, 'restore-per-charge', stick.values.restore_per_charge, 'здоровья и маны за заряд', 'Используется Magic Stick с хотя бы одним зарядом.',
    `Каждый заряд Magic Stick мгновенно восстанавливает ${stick.values.restore_per_charge} здоровья и ${stick.values.restore_per_charge} маны.`, ['description: restores 15 health and mana per charge']),
  fact(stick, 'max-charges', stick.values.max_charges, 'зарядов', 'Обычный Magic Stick без улучшения в Magic Wand.',
    `Magic Stick может хранить до ${stick.values.max_charges} зарядов.`, ['description: up to 10 charges']),
  fact(stick, 'charge-radius', stick.values.charge_radius, 'радиуса', 'Враг видим владельцу Magic Stick и применяет способность, которая даёт заряд.',
    `Magic Stick получает заряд от подходящего применения способности видимым врагом в радиусе ${stick.values.charge_radius}.`, ['description: visible enemy within 1200']),
  fact(stick, 'cooldown', stick.values.cooldown, 'сек.', 'После использования Energy Charge.',
    `Перезарядка Magic Stick после использования — ${stick.values.cooldown} секунд.`, ['abilities[0].cooldown']),

  fact(wand, 'restore-per-charge', wand.values.restore_per_charge, 'здоровья и маны за заряд', 'Используется Magic Wand с хотя бы одним зарядом.',
    `Каждый заряд Magic Wand мгновенно восстанавливает ${wand.values.restore_per_charge} здоровья и ${wand.values.restore_per_charge} маны.`, ['description: restores 15 health and mana per charge']),
  fact(wand, 'max-charges', wand.values.max_charges, 'зарядов', 'Обычный Magic Wand.',
    `Magic Wand может хранить до ${wand.values.max_charges} зарядов.`, ['description: up to 20 charges']),
  fact(wand, 'attributes', wand.values.bonus_all_stats, 'к каждому атрибуту', 'Magic Wand находится в активном инвентаре.',
    `Magic Wand даёт +${wand.values.bonus_all_stats} к силе, ловкости и интеллекту.`, ['stats: +3 all attributes']),
  fact(wand, 'cooldown', wand.values.cooldown, 'сек.', 'После использования Energy Charge.',
    `Перезарядка Magic Wand после использования — ${wand.values.cooldown} секунд.`, ['abilities[0].cooldown']),

  fact(treads, 'attribute', treads.values.bonus_attribute, 'к выбранному атрибуту', 'Power Treads переключены на силу, ловкость или интеллект.',
    `Power Treads дают +${treads.values.bonus_attribute} к выбранному атрибуту.`, ['stats: +10 selected attribute']),
  fact(treads, 'attack-speed', treads.values.attack_speed, 'к скорости атаки', 'Power Treads находятся в активном инвентаре.',
    `Power Treads дают +${treads.values.attack_speed} к скорости атаки.`, ['stats: +25 attack speed']),
  fact(treads, 'ranged-move-speed', treads.values.ranged_move_speed, 'к скорости передвижения', 'Power Treads надеты на героя дальнего боя.',
    `Герой дальнего боя получает +${treads.values.ranged_move_speed} к скорости передвижения от Power Treads.`, ['stats: +45 ranged movement speed']),
  fact(treads, 'melee-move-speed', treads.values.melee_move_speed, 'к скорости передвижения', 'Power Treads надеты на героя ближнего боя.',
    `Герой ближнего боя получает +${treads.values.melee_move_speed} к скорости передвижения от Power Treads.`, ['stats: +55 melee movement speed']),

  fact(blink, 'range', blink.values.blink_range, 'дальности', 'Blink Dagger доступен для использования.',
    `Blink Dagger мгновенно перемещает владельца на расстояние до ${blink.values.blink_range}.`, ['abilities[0].range']),
  fact(blink, 'damage-lockout', blink.values.damage_lockout, 'сек.', 'Владелец получил урон от вражеского героя или Рошана.',
    `После такого урона Blink Dagger нельзя использовать ${blink.values.damage_lockout} секунды.`, ['description: disabled for 3 seconds after damage']),
  fact(blink, 'cooldown', blink.values.cooldown, 'сек.', 'После успешного использования Blink.',
    `Обычная перезарядка Blink Dagger — ${blink.values.cooldown} секунд.`, ['abilities[0].cooldown']),

  fact(bkb, 'magic-resistance', bkb.values.magic_resistance, '%', 'Во время действия Avatar.',
    `Black King Bar во время Avatar даёт +${bkb.values.magic_resistance}% к сопротивлению магии.`, ['description: +60% magic resistance']),
  fact(bkb, 'first-duration', bkb.values.first_duration, 'сек.', 'Первое использование нового Black King Bar.',
    `Первое применение Avatar длится ${bkb.values.first_duration} секунд. Последующие использования сокращают длительность.`, ['description: duration 9 / 8 / 7']),
  fact(bkb, 'minimum-duration', bkb.values.minimum_duration, 'сек.', 'Black King Bar уже достиг минимальной длительности Avatar.',
    `Минимальная длительность Avatar — ${bkb.values.minimum_duration} секунд.`, ['description: duration 9 / 8 / 7']),
  fact(bkb, 'mana-cost', bkb.values.mana_cost, 'маны', 'Использование Avatar.',
    `Активация Black King Bar расходует ${bkb.values.mana_cost} маны.`, ['abilities[0].mana']),
  fact(bkb, 'cooldown', bkb.values.cooldown, 'сек.', 'После использования Avatar.',
    `Перезарядка Black King Bar — ${bkb.values.cooldown} секунд.`, ['abilities[0].cooldown']),
  fact(bkb, 'strength', bkb.values.bonus_strength, 'к силе', 'Black King Bar находится в активном инвентаре.',
    `Black King Bar даёт +${bkb.values.bonus_strength} к силе.`, ['stats: +10 strength']),
  fact(bkb, 'damage', bkb.values.bonus_damage, 'к урону', 'Black King Bar находится в активном инвентаре.',
    `Black King Bar даёт +${bkb.values.bonus_damage} к урону.`, ['stats: +24 damage'])
];

export const starterItems: QuestionBank = {
  id: 'starter-items-7.41e-v2', patch: verification.patch,
  entities: [fire, branch, clarity, mango, salve, bottle, tango, stick, wand, treads, blink, bkb], facts,
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
    {id: 'tango-heal', factId: 'item_tango.heal-total', prompt: 'Сколько здоровья суммарно восстанавливает Tango после обычного дерева?', distractors: [90, 115, 140]},

    {id: 'stick-restore', factId: 'item_magic_stick.restore-per-charge', prompt: 'Сколько здоровья и маны восстанавливает один заряд Magic Stick?', distractors: [10, 20, 25]},
    {id: 'stick-max-charges', factId: 'item_magic_stick.max-charges', prompt: 'Сколько зарядов максимум хранит Magic Stick?', distractors: [5, 15, 20]},
    {id: 'stick-radius', factId: 'item_magic_stick.charge-radius', prompt: 'В каком радиусе Magic Stick получает заряд от подходящего заклинания видимого врага?', distractors: [900, 1000, 1500]},
    {id: 'stick-cooldown', factId: 'item_magic_stick.cooldown', prompt: 'Какая перезарядка у Magic Stick после использования?', distractors: [13, 15, 20]},

    {id: 'wand-restore', factId: 'item_magic_wand.restore-per-charge', prompt: 'Сколько здоровья и маны восстанавливает один заряд Magic Wand?', distractors: [10, 20, 25]},
    {id: 'wand-max-charges', factId: 'item_magic_wand.max-charges', prompt: 'Сколько зарядов максимум хранит Magic Wand?', distractors: [10, 15, 25]},
    {id: 'wand-attributes', factId: 'item_magic_wand.attributes', prompt: 'Сколько Magic Wand даёт к каждому атрибуту?', distractors: [1, 2, 4]},
    {id: 'wand-cooldown', factId: 'item_magic_wand.cooldown', prompt: 'Какая перезарядка у Magic Wand после использования?', distractors: [10, 17, 20]},

    {id: 'treads-attribute', factId: 'item_power_treads.attribute', prompt: 'Сколько Power Treads дают к выбранному атрибуту?', distractors: [8, 12, 15]},
    {id: 'treads-attack-speed', factId: 'item_power_treads.attack-speed', prompt: 'Сколько скорости атаки дают Power Treads?', distractors: [15, 20, 30]},
    {id: 'treads-ranged-ms', factId: 'item_power_treads.ranged-move-speed', prompt: 'Сколько скорости передвижения дают Power Treads герою дальнего боя?', distractors: [40, 50, 55]},
    {id: 'treads-melee-ms', factId: 'item_power_treads.melee-move-speed', prompt: 'Сколько скорости передвижения дают Power Treads герою ближнего боя?', distractors: [45, 50, 60]},

    {id: 'blink-range', factId: 'item_blink.range', prompt: 'Какова максимальная дальность обычного Blink Dagger?', distractors: [1000, 1100, 1400]},
    {id: 'blink-lockout', factId: 'item_blink.damage-lockout', prompt: 'На сколько секунд Blink Dagger блокируется после урона от вражеского героя или Рошана?', distractors: [2, 4, 5]},
    {id: 'blink-cooldown', factId: 'item_blink.cooldown', prompt: 'Какая обычная перезарядка Blink Dagger?', distractors: [12, 18, 20]},

    {id: 'bkb-magic-resistance', factId: 'item_black_king_bar.magic-resistance', prompt: 'Сколько сопротивления магии даёт Avatar от Black King Bar?', distractors: [50, 70, 80]},
    {id: 'bkb-first-duration', factId: 'item_black_king_bar.first-duration', prompt: 'Сколько длится первое использование Black King Bar?', distractors: [6, 7, 8]},
    {id: 'bkb-min-duration', factId: 'item_black_king_bar.minimum-duration', prompt: 'До какой минимальной длительности сокращается Black King Bar?', distractors: [5, 6, 8]},
    {id: 'bkb-mana', factId: 'item_black_king_bar.mana-cost', prompt: 'Сколько маны стоит активация Black King Bar?', distractors: [0, 25, 75]},
    {id: 'bkb-cooldown', factId: 'item_black_king_bar.cooldown', prompt: 'Какая перезарядка у Black King Bar?', distractors: [80, 90, 100]},
    {id: 'bkb-strength', factId: 'item_black_king_bar.strength', prompt: 'Сколько силы даёт Black King Bar?', distractors: [8, 12, 15]},
    {id: 'bkb-damage', factId: 'item_black_king_bar.damage', prompt: 'Сколько урона даёт Black King Bar?', distractors: [18, 20, 30]}
  ]
};
