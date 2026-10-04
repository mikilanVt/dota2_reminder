import type {HeroCatalog, HeroDetail, HeroGuide} from './types';
export const heroAsset = (path: string) => `${import.meta.env.BASE_URL}assets/heroes/${path}`;
export const attributeNames = ['Сила', 'Ловкость', 'Интеллект', 'Универсальные'];
export const attributeKeys = ['strength', 'agility', 'intelligence', 'universal'];
export const number = (value: number) => Number(value.toFixed(2)).toLocaleString('ru-RU');
export const levels = (values: number[]) => [...new Set(values)].map(number).join(' / ');
// Cards are fetched individually. Bound the cache even during long browsing sessions.
const cards = new Map<number, HeroDetail>();
let catalog: HeroCatalog | undefined;
async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(heroAsset(path), {signal});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
export async function loadCatalog(signal: AbortSignal) {
  return catalog ??= await read<HeroCatalog>('catalog.json', signal);
}
export async function loadHero(id: number, signal: AbortSignal) {
  const cached = cards.get(id);
  if (cached) {cards.delete(id); cards.set(id, cached); return cached;}
  const card = await read<HeroDetail>(`details/${id}.json`, signal);
  if (card.id !== id) throw new Error('Unexpected hero');
  cards.set(id, card);
  if (cards.size > 8) cards.delete(cards.keys().next().value!);
  return card;
}
export const loadGuide = (id: number, signal: AbortSignal) => read<HeroGuide>(`guides/${id}.json`, signal);
