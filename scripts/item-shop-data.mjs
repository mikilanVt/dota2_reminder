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
    const heading = cleaned.content.replace(/^[+%\-\s]+/, '').replace(/:$/, '');
    return {label: heading, value: value.values_float.map(number).join(' / ') + (value.is_percentage ? '%' : '')};
  });
  return {
    id: parsed.id, name: parsed.name_loc, cost: parsed.item_cost,
    description: description.content, notes: notes.map(note => note.content), lore: lore.content,
    stats, mana: parsed.mana_costs, cooldown: parsed.cooldowns, channel: parsed.channel_times,
    source: `https://www.dota2.com/datafeed/itemdata?language=russian&item_id=${parsed.id}`,
    retrievedAt: date, unresolved: description.unresolved || notes.some(note => note.unresolved) || lore.unresolved || unresolvedStats
  };
}
