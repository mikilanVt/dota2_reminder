import generated from './item-quiz.generated.json' with {type: 'json'};
import {starterItems} from './starter-items.js';
import type {AnswerValue, ChoiceQuestion, GameEntity, GameFact, QuestionBank, QuestionCategory} from './types.js';

interface Row {
  key: string;
  kind: string;
  value: AnswerValue;
  label?: string;
  unit?: string;
  prompt?: string;
  conditions?: string;
  evidence?: string;
  choices?: readonly AnswerValue[];
}

const number = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 3});
const defaultConditions: Partial<Record<QuestionCategory, string>> = {
  recognition: 'Выбери название предмета на картинке.',
  price: 'Полная стоимость готового предмета или одной покупаемой пачки. Без скидок.',
  stats: 'Один предмет. Только его собственный бонус, без ауры, активного эффекта и прибавок от атрибутов.',
  mana: 'Расход маны на одно применение, без модификаторов.',
  cooldown: 'Перезарядка одного применения, без сокращения и сброса.',
  tier: 'Обычный режим игры.',
  timing: 'Обычный режим игры. Это начало доступности, а не гарантированное выпадение.'
};

function numericAlternatives(value: number, unit: string): number[] {
  const step = unit === 'золота' ? (value >= 1000 ? 250 : 25)
    : value === 0 ? 10 : value < 1 ? .1 : value < 5 ? (Number.isInteger(value) ? 1 : .25)
    : value < 20 ? 2 : value < 100 ? 10 : value < 500 ? 25 : 100;
  const values: number[] = [];
  for (const delta of [-1, 1, -2, 2, -3, 3, -4, 4]) {
    const candidate = Number((value + delta * step).toFixed(3));
    if (candidate >= 0 && candidate !== value && !values.includes(candidate)
      && !(unit === '%' && value <= 100 && candidate > 100)) values.push(candidate);
    if (values.length === 3) break;
  }
  return values;
}

const entities: GameEntity[] = generated.items.map(item => {
  const original = starterItems.entities.find(entity => entity.valveId === item.id);
  return {
    id: `item_${item.key}`, valveId: item.id, name: item.name, image: `assets/item-shop/icons/${item.icon}`,
    topic: 'items', aliases: original?.aliases ?? [], values: original?.values ?? {},
    source: {title: `${item.name} — данные Valve`, url: `https://www.dota2.com/datafeed/itemdata?language=russian&item_id=${item.id}`, retrievedAt: item.date},
    verification: {patch: generated.patch, checkedAt: item.date, status: 'verified'}
  };
});
const facts: GameFact[] = [...starterItems.facts];
const questions: ChoiceQuestion[] = starterItems.questions.map(question => ({...question,
  category: ['fire-damage', 'branch-attributes'].includes(question.id) ? 'stats' : 'effect'}));
const defaultUnits: Partial<Record<QuestionCategory, string>> = {price: 'золота', mana: 'маны', cooldown: 'сек.', tier: 'разряд', timing: 'мин.'};
const defaultEvidence: Partial<Record<QuestionCategory, string>> = {recognition: 'name_loc', price: 'item_cost', mana: 'mana_costs[0]',
  cooldown: 'cooldowns[0]', tier: 'item_neutral_tier + 1', timing: 'neutral-item-times-2026-09-10.json'};

for (const [index, item] of generated.items.entries()) {
  const entity = entities[index];
  for (const row of item.rows as readonly Row[]) {
    const category = row.kind as QuestionCategory;
    const unit = row.unit ?? defaultUnits[category] ?? '';
    const prompts: Partial<Record<QuestionCategory, string>> = {
      recognition: 'Как называется предмет на картинке?', price: `Сколько стоит ${item.name}?`,
      stats: `Какой бонус ${row.label} даёт ${item.name}?`, mana: `Сколько маны нужно для применения ${item.name}?`,
      cooldown: `Сколько длится перезарядка ${item.name}?`, tier: `Какой разряд у ${item.name}?`,
      timing: `С какой минуты может быть доступен ${item.name}?`,
      dispel: `Можно ли снять развеиванием ${row.label} от ${item.name}?`
    };
    const prompt = row.prompt?.replaceAll('{item}', item.name) ?? prompts[category];
    if (!prompt) throw new Error(`Missing question template: ${row.kind}`);
    let distractors = row.choices;
    if (category === 'recognition') {
      // Deterministic answer IDs keep exported and unfinished rounds stable.
      distractors = [1, 11, 37].map(offset => generated.items[(index + offset) % generated.items.length].name);
    } else if (category === 'tier') distractors = [1, 2, 3, 4, 5].filter(value => value !== row.value).slice(0, 3);
    else if (category === 'timing') distractors = [0, 15, 25, 35, 60].filter(value => value !== row.value).slice(0, 3);
    else if (!distractors && typeof row.value === 'number') distractors = numericAlternatives(row.value, unit);
    if (!distractors) throw new Error(`Missing answers: ${item.key}.${row.key}`);
    const factId = `${entity.id}.quiz.${row.key}`;
    const formatted = typeof row.value === 'number' ? `${number.format(row.value)} ${unit}`.trim() : row.value;
    const explanation = category === 'recognition' ? `На картинке — ${item.name}.`
      : category === 'stats' ? `${item.name}: +${number.format(row.value as number)}${unit === '%' ? '%' : ''} ${row.label}${unit === 'ед./сек.' ? ' в секунду' : ''}.`
      : category === 'dispel' ? `${item.name}, ${row.label}: ${formatted.toLocaleLowerCase('ru-RU')}.`
      : `${prompt} Ответ: ${formatted}.`;
    const evidence = row.evidence ?? defaultEvidence[category] ?? `special_values.${row.key}`;
    const source = category === 'timing' ? {title: 'Патч 7.41 и тайминги игрового клиента',
      url: 'https://www.dota2.com/patches/7.41', retrievedAt: '2026-09-10'} : entity.source;
    facts.push({id: factId, entityId: entity.id, topic: 'items', value: row.value, unit,
      conditions: row.conditions ?? defaultConditions[category] ?? 'Базовое значение без усилений, сопротивлений и досрочного снятия эффекта.',
      explanation, evidence: [evidence], source, verification: {...entity.verification, checkedAt: source.retrievedAt}});
    questions.push({id: `q.${item.id}.${row.key}`, factId, prompt, distractors, category});
  }
}

// Additive extension: the original fourteen facts and answer IDs are unchanged.
// If any existing answer changes with a patch, bump the bank ID as well.
export const itemBank: QuestionBank = {id: starterItems.id, patch: generated.patch, entities, facts, questions};
