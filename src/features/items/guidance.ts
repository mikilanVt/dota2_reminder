import guideData from '../../data/item-guidance.json' with {type: 'json'};
import catalog from '../../data/item-shop-catalog.json' with {type: 'json'};
import type {ShopItem} from './types';

export type Position = 1 | 2 | 3 | 4 | 5;
interface Advice {
  purpose: string;
  roles: readonly {positions: readonly Position[]; reason: string}[];
  tips: readonly string[];
  caution: string;
  heroes?: readonly string[];
  alternatives?: readonly string[];
}
interface GuidanceData {
  patch: string;
  positions: readonly {id: Position; name: string}[];
  advice: Record<string, Advice>;
}

export const guidance = guideData as GuidanceData;
const items: readonly ShopItem[] = [...catalog.groups.flatMap(group => group.items), ...catalog.extras];
export const itemByKey = new Map(items.map(item => [item.key, item]));

export function adviceFor(item: ShopItem, patch = catalog.patch): Advice | undefined {
  return guidance.patch === patch ? guidance.advice[item.key] : undefined;
}
