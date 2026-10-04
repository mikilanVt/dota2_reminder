import {gzipSync} from 'node:zlib';
import {readdir, readFile, stat} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url));
const JS_GZIP_LIMIT = 150 * 1024;
const TOTAL_GZIP_LIMIT = 1024 * 1024;
const ITEM_SHOP_GZIP_LIMIT = 768 * 1024;
// The complete archive is on disk, not in the initial request. Hero cards,
// renders and spell icons are fetched only when a player opens that hero.
const HERO_LIBRARY_GZIP_LIMIT = 12 * 1024 * 1024;
const HERO_CATALOG_GZIP_LIMIT = 700 * 1024;
const HERO_PAGE_GZIP_LIMIT = 220 * 1024;

async function collectFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else files.push(path);
  }

  return files;
}

const files = await collectFiles(DIST_DIR);
let jsGzipBytes = 0;
let totalGzipBytes = 0;
let itemShopGzipBytes = 0;
let itemShopFiles = 0;
let heroBytes = 0;
let heroCatalogBytes = 0;
const heroFileBytes = new Map();

for (const file of files) {
  const info = await stat(file);
  if (info.size === 0) continue;
  const content = await readFile(file);
  const gzipBytes = gzipSync(content, {level: 9}).byteLength;
  totalGzipBytes += gzipBytes;
  if (file.endsWith('.js')) jsGzipBytes += gzipBytes;
  const path = relative(DIST_DIR, file);
  if (path.startsWith('assets/heroes/')) {
    heroBytes += gzipBytes;
    const localPath = path.slice('assets/heroes/'.length);
    heroFileBytes.set(localPath, gzipBytes);
    if (localPath.startsWith('portraits/') || localPath.startsWith('attributes/') || localPath === 'catalog.json')
      heroCatalogBytes += gzipBytes;
    continue;
  }
  if (relative(DIST_DIR, file).startsWith('assets/item-shop/')) {
    itemShopGzipBytes += gzipBytes;
    itemShopFiles++;
    continue;
  }
  console.log(`${relative(DIST_DIR, file)}: ${info.size} B raw / ${gzipBytes} B gzip`);
}

console.log(`JavaScript gzip total: ${jsGzipBytes} B / limit ${JS_GZIP_LIMIT} B`);
console.log(`Core build files gzip: ${totalGzipBytes - itemShopGzipBytes - heroBytes} B / limit ${TOTAL_GZIP_LIMIT} B`);
console.log(`Item shop assets (${itemShopFiles} files, loaded on demand): ${itemShopGzipBytes} B / limit ${ITEM_SHOP_GZIP_LIMIT} B`);
console.log(`Hero library on demand: ${heroBytes} B / limit ${HERO_LIBRARY_GZIP_LIMIT} B`);
console.log(`Hero catalog including ALL portraits: ${heroCatalogBytes} B / limit ${HERO_CATALOG_GZIP_LIMIT} B`);

if (jsGzipBytes > JS_GZIP_LIMIT)
  throw new Error('Initial JavaScript budget exceeded.');
if (totalGzipBytes - itemShopGzipBytes - heroBytes > TOTAL_GZIP_LIMIT)
  throw new Error('Initial transfer budget exceeded.');
if (itemShopGzipBytes > ITEM_SHOP_GZIP_LIMIT)
  throw new Error('Item shop asset budget exceeded.');
if (heroBytes > HERO_LIBRARY_GZIP_LIMIT || heroCatalogBytes > HERO_CATALOG_GZIP_LIMIT)
  throw new Error('Hero library or portrait catalog budget exceeded.');
for (const [path, bytes] of heroFileBytes) {
  if (!path.startsWith('details/')) continue;
  const card = JSON.parse(await readFile(join(DIST_DIR, 'assets/heroes', path), 'utf8'));
  const pageBytes = bytes + (heroFileBytes.get(card.art) ?? 0)
    + card.abilities.reduce((sum, ability) => sum + (heroFileBytes.get(ability.icon) ?? 0), 0)
    + (heroFileBytes.get(`guides/${card.id}.json`) ?? 0);
  if (pageBytes > HERO_PAGE_GZIP_LIMIT) throw new Error(`Hero ${card.key} exceeds its transfer budget.`);
}
