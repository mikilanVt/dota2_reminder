export interface HeroSummary {
  id: number; key: string; name: string; englishName: string;
  attribute: number; complexity: number; attack: number;
}
export interface HeroCatalog {patch: string; retrievedAt: string; heroes: HeroSummary[]}
export interface HeroAbility {
  id: number; key: string; name: string; icon: string | null;
  innate: boolean; ultimate: boolean; passive: boolean; grantedBy: 'scepter' | 'shard' | null;
  description: string; notes: string[];
  properties: {label: string; value: string}[]; stats: {label: string; value: string}[];
  mana: number[]; cooldown: number[]; range: number[];
  upgrades: {kind: 'scepter' | 'shard'; text: string; unresolved: boolean}[];
  unresolved: boolean;
}
export interface HeroDetail extends HeroSummary {
  patch: string; retrievedAt: string; art: string | null;
  introduction: string; tagline: string; biography: string;
  attributes: number[][];
  stats: {damage: number[]; armor: number; speed: number; attackTime: number; range: number;
    health: number; healthRegen: number; mana: number; manaRegen: number; magicResistance: number; vision: number[]};
  abilities: HeroAbility[];
  talents: {id: number; key: string; level: number; text: string; unresolved: boolean}[];
}
export interface HeroGuide {
  heroId: number; patch: string; checkedAt: string; role: string; title: string;
  summary: string; source: string; sourceLabel: string; sample: string;
  skillOrder: string[]; talentChoices: string[];
  itemGroups: {title: string; items: {key: string; name: string; timing?: string; reason: string}[]}[];
  chapters: {title: string; text: string}[];
  replay: {label: string; url: string; note: string};
}
