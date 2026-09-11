import guideData from '../../data/item-guidance.json' with {type: 'json'};
import catalog from '../../data/item-shop-catalog.json' with {type: 'json'};
import type {ShopItem} from './types';

export type Position = 1 | 2 | 3 | 4 | 5;
interface Acquisition {
  text: string;
  note?: string;
  unavailable?: boolean;
  related?: readonly string[];
  sources: readonly string[];
}
interface Advice {
  purpose: string;
  roles: readonly {positions: readonly Position[]; reason: string}[];
  caution: string;
  sources: readonly string[];
}
interface GuidanceData {
  patch: string;
  reviewedAt: string;
  positions: readonly {id: Position; name: string}[];
  sources: Record<string, {title: string; url: string}>;
  rules: Record<string, Acquisition>;
  acquisition: Record<string, Acquisition>;
  advice: Record<string, Advice>;
}

export const guidance = guideData as GuidanceData;
const items: readonly ShopItem[] = [...catalog.groups.flatMap(group => group.items), ...catalog.extras];
const byId = new Map(items.map(item => [item.id, item]));
export const itemByKey = new Map(items.map(item => [item.key, item]));

function needsSecretShop(item: ShopItem, visited = new Set<number>()): boolean {
  if (item.group === 'secret') return true;
  if (visited.has(item.id)) return false;
  visited.add(item.id);
  return (item.recipe?.variants?.flat() ?? item.recipe?.components ?? []).some(id => {
    const component = byId.get(id);
    return component ? needsSecretShop(component, visited) : false;
  });
}

export function acquisitionFor(item: ShopItem): Acquisition {
  const special = guidance.acquisition[item.key];
  if (special) return special;
  const group = catalog.groups.find(group => group.id === item.group);
  if (group?.tier) return {
    ...guidance.rules.neutral,
    text: guidance.rules.neutral.text.replace('{time}', group.unlockTime!),
  };
  if (item.group === 'enhancements') return guidance.rules.enhancement;
  if (item.group === 'secret') return guidance.rules.secret;
  if (item.group === 'recipes') return guidance.rules.recipe;
  if (item.recipe) return {
    ...guidance.rules.assembled,
    note: needsSecretShop(item) ? 'Часть компонентов покупается в потайной лавке. Состав показан в схеме ниже.' : guidance.rules.assembled.note,
  };
  return guidance.rules.shop;
}

export function adviceFor(item: ShopItem, patch = catalog.patch): Advice | undefined {
  return guidance.patch === patch ? guidance.advice[item.key] : undefined;
}
