export interface ShopItem {
  id: number;
  key: string;
  name: string;
  englishName: string;
  group: string;
  icon: string;
}

export interface ShopGroup {
  id: string;
  title: string;
  column: 'basic' | 'upgrades' | 'neutral';
  items: readonly ShopItem[];
  tier?: number;
}

export interface ItemDescription {
  id: number;
  name: string;
  cost: number;
  description: string;
  notes: readonly string[];
  lore: string;
  stats: readonly {label: string; value: string}[];
  mana: readonly number[];
  cooldown: readonly number[];
  channel: readonly number[];
  source: string;
  retrievedAt: string;
  patchContext: string;
  verification: 'imported';
  unresolved: boolean;
}
