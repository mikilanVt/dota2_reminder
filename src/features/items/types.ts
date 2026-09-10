export interface ShopItem {
  id: number;
  key: string;
  name: string;
  englishName: string;
  group: string;
  icon: string;
  recipe?: {components: readonly number[]; variants?: readonly (readonly number[])[]; scroll?: number};
}

export interface ShopGroup {
  id: string;
  title: string;
  column: 'basic' | 'upgrades' | 'neutral';
  items: readonly ShopItem[];
  tier?: number;
  unlockTime?: string;
}

export interface ItemDescription {
  id: number;
  name: string;
  cost: number;
  description: string;
  notes: readonly string[];
  lore: string;
  stats: readonly {label: string; value: string; sign: string; penalty: boolean}[];
  properties: readonly {label: string; value: string; kind?: string}[];
  abilities: readonly {title: string; description: string; kind: 'active' | 'passive' | 'use'; range: readonly number[]; mana: readonly number[]; cooldown: readonly number[]; channel: readonly number[]}[];
  mana: readonly number[];
  cooldown: readonly number[];
  channel: readonly number[];
  source: string;
  retrievedAt: string;
  patchContext: string;
  verification: 'imported';
  unresolved: boolean;
}
