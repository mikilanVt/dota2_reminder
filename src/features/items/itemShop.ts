import catalog from '../../data/item-shop-catalog.json';
import type {ShopGroup, ShopItem} from './types';

export const groups = catalog.groups as ShopGroup[];
export const allItems: readonly ShopItem[] = [...groups.flatMap(group => group.items), ...catalog.extras];
export const itemById = new Map(allItems.map(item => [item.id, item]));
export const asset = (path: string) => `${import.meta.env.BASE_URL}assets/item-shop/${path}`;
export const snapshotDate = catalog.retrievedAt;
