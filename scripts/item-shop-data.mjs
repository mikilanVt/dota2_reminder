const headings = {
  agi: 'Ловкость', all: 'Все атрибуты', aoe_bonus: 'Радиус действия', armor: 'Броня',
  attack: 'Скорость атаки', attack_pct: 'Скорость атаки', attack_range: 'Дальность атаки',
  attack_range_all: 'Дальность атаки', attack_range_melee: 'Дальность атаки в ближнем бою',
  cast_range: 'Дальность применения', cooldown_reduction: 'Сокращение перезарядки',
  damage: 'Урон от атак', debuff_amp: 'Длительность отрицательных эффектов', evasion: 'Уклонение',
  healing_amp: 'Усиление лечения', health: 'Здоровье', hp_regen: 'Восстановление здоровья',
  int: 'Интеллект', lifesteal: 'Вампиризм', mana: 'Мана', mana_regen: 'Восстановление маны',
  max_mana_percentage: 'Максимальная мана', move_speed: 'Скорость передвижения',
  primary_attribute: 'Основной атрибут', projectile_speed: 'Скорость снарядов',
  restoration_amp: 'Усиление восстановления', selected_attrib: 'Выбранный атрибут',
  slow_resistance: 'Сопротивление замедлениям', spell_lifesteal: 'Вампиризм от заклинаний',
  spell_resist: 'Сопротивление магии', status_resist: 'Сопротивление эффектам', str: 'Сила'
};
const number = value => Number.isInteger(value) ? String(value) : Number(value.toFixed(3)).toString().replace('.', ',');
const statLabels = {
  agi: 'к ловкости', all: 'ко всем атрибутам', aoe_bonus: 'к радиусу действия', armor: 'к броне',
  attack: 'к скорости атаки', attack_pct: 'к скорости атаки', attack_range: 'к дальности атаки',
  attack_range_all: 'к дальности атаки', attack_range_melee: 'к дальности атаки в ближнем бою',
  cast_range: 'к дальности применения', cooldown_reduction: 'к сокращению перезарядки',
  damage: 'к урону', debuff_amp: 'к длительности отрицательных эффектов', evasion: 'к уклонению',
  healing_amp: 'к усилению лечения', health: 'к здоровью', hp_regen: 'к восстановлению здоровья',
  int: 'к интеллекту', lifesteal: 'к вампиризму', mana: 'к мане', mana_regen: 'к восстановлению маны',
  max_mana_percentage: 'к максимальной мане', move_speed: 'к скорости передвижения',
  primary_attribute: 'к основному атрибуту', projectile_speed: 'к скорости снарядов',
  restoration_amp: 'к усилению восстановления', selected_attrib: 'к выбранному атрибуту',
  slow_resistance: 'к сопротивлению замедлениям', spell_lifesteal: 'к вампиризму от заклинаний',
  spell_resist: 'к сопротивлению магии', status_resist: 'к сопротивлению эффектам', str: 'к силе'
};

export function itemProperties(item) {
  const properties = [];
  const behavior = BigInt(item.behavior);
  const has = flag => (behavior & BigInt(flag)) !== 0n;
  const type = has(128) ? 'прерываемая' : has(512) ? 'переключаемая' : has(65536) ? 'аура'
    : has(8) ? 'направленная на существо' : has(16) ? 'направленная на точку'
    : has(4) ? 'ненаправленная' : has(4096) ? 'автоприменение' : has(2) ? 'пассивная' : null;
  if (type) properties.push({label: 'ТИП', value: type});
  const team = item.target_team;
  const target = item.target_type;
  if (team === 1 || team === 2) {
    const side = team === 1 ? 'союзных' : 'вражеских';
    const sideObjects = team === 1 ? 'союзные' : 'вражеские';
    const value = (target & 7) === 7 ? `на ${side} существ и ${sideObjects} постройки`
      : (target & 3) === 3 ? `на ${side} существ` : (target & 5) === 5 ? `на ${side} героев и ${sideObjects} постройки`
      : (target & 1) ? `на ${side} героев` : (target & 2) ? `на ${side} крипов`
      : (target & 4) ? `на ${sideObjects} постройки` : team === 1 ? 'на союзников' : 'на врагов';
    properties.push({label: 'ДЕЙСТВУЕТ', value});
  } else if (team === 3) properties.push({label: 'ДЕЙСТВУЕТ', value: (target & 3) === 1 ? 'на героев' : 'на существ'});
  else if (target & 64) properties.push({label: 'ДЕЙСТВУЕТ', value: 'на деревья'});
  const damage = {1: 'физический', 2: 'магический', 4: 'чистый', 8: 'потеря здоровья'}[item.damage];
  if (damage) properties.push({label: 'УРОН', value: damage, kind: `damage-${item.damage}`});
  const immunity = {1: 'да', 2: 'нет', 3: 'да', 4: 'нет', 5: 'союзники — да, враги — нет'}[item.immunity];
  if (immunity) properties.push({label: 'СКВОЗЬ НЕВОСПР. К ЭФФЕКТАМ', value: immunity});
  const dispel = {1: 'сильным развеиванием', 2: 'да', 3: 'нет'}[item.dispellable];
  if (dispel) properties.push({label: 'МОЖНО РАЗВЕЯТЬ', value: dispel});
  return properties;
}

function abilitySections(item, values) {
  const headings = [...item.desc_loc.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis)];
  const sections = [];
  const before = item.desc_loc.slice(0, headings[0]?.index ?? item.desc_loc.length);
  if (cleanItemText(before, values).content) sections.push({title: '', body: before});
  for (let i = 0; i < headings.length; i++) sections.push({title: headings[i][1], body: item.desc_loc.slice(headings[i].index + headings[i][0].length, headings[i + 1]?.index)});
  let parametersUsed = false;
  return sections.map(section => {
    const title = cleanItemText(section.title, values).content;
    const kind = /^Использование/i.test(title) ? 'use' : /^Актив|^Переключ/i.test(title) ? 'active' : 'passive';
    const includeParameters = !parametersUsed && kind !== 'passive';
    if (includeParameters) parametersUsed = true;
    return {title, description: cleanItemText(section.body, values).content, kind,
      range: includeParameters ? item.cast_ranges : [], mana: includeParameters ? item.mana_costs : [],
      cooldown: includeParameters ? item.cooldowns : [], channel: includeParameters ? item.channel_times : []};
  });
}

export function cleanItemText(text, values) {
  let unresolved = false;
  const resolved = text.replace(/%([a-zA-Z_0-9]+)%/g, (_, key) => {
    const value = values.get(key.toLowerCase());
    if (!value?.length) {unresolved = true; return '…';}
    return value.map(number).join(' / ');
  });
  const content = resolved.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/?h[1-6][^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/%{2,}/g, '%')
    .replace(/\$([a-z_]+)/g, (_, key) => {
      if (headings[key]) return headings[key];
      unresolved = true; return 'Параметр';
    }).replace(/\n{3,}/g, '\n\n').trim();
  return {content, unresolved};
}

export function itemDescription(parsed, date) {
  const values = new Map(parsed.special_values.map(value => [value.name.toLowerCase(), value.values_float]));
  for (const [key, field] of [['abilitycooldown', 'cooldowns'], ['abilitymanacost', 'mana_costs'], ['abilitychanneltime', 'channel_times']])
    if (!values.has(key)) values.set(key, parsed[field]);
  const description = cleanItemText(parsed.desc_loc, values);
  const notes = parsed.notes_loc.map(note => cleanItemText(note, values));
  const lore = cleanItemText(parsed.lore_loc, values);
  let unresolvedStats = false;
  const stats = parsed.special_values.filter(value => value.heading_loc && value.values_float.length).map(value => {
    const cleaned = cleanItemText(value.heading_loc, values);
    unresolvedStats ||= cleaned.unresolved;
    const token = value.heading_loc.match(/\$([a-z_]+)/)?.[1];
    const label = (statLabels[token] ?? cleaned.content.replace(/^[+%\-\s]+/, '').replace(/:$/, '').toLowerCase());
    const negative = /^-/.test(cleaned.content) || value.values_float.every(value => value <= 0) && value.values_float.some(value => value < 0);
    const sign = negative ? '−' : /^\+/.test(cleaned.content) ? '+' : '';
    return {label, value: value.values_float.map(value => number(sign ? Math.abs(value) : value)).join(' / ') + (value.is_percentage ? '%' : ''), sign, penalty: negative || /#e03e2e/.test(value.heading_loc)};
  });
  return {
    id: parsed.id, name: parsed.name_loc, cost: parsed.item_cost,
    description: description.content, notes: notes.map(note => note.content), lore: lore.content,
    stats, properties: itemProperties(parsed), abilities: abilitySections(parsed, values),
    mana: parsed.mana_costs, cooldown: parsed.cooldowns, channel: parsed.channel_times,
    source: `https://www.dota2.com/datafeed/itemdata?language=russian&item_id=${parsed.id}`,
    retrievedAt: date, unresolved: description.unresolved || notes.some(note => note.unresolved) || lore.unresolved || unresolvedStats
  };
}
