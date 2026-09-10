import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {itemDescription} from './item-shop-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const date = new Date().toISOString().slice(0, 10);
const cacheDate = process.argv.find(argument => argument.startsWith('--cache-date='))?.slice('--cache-date='.length);
if (cacheDate && (!/^\d{4}-\d{2}-\d{2}$/.test(cacheDate) || cacheDate > date)) throw new Error('Invalid cache date');
const output = `${root}public/assets/item-shop`;
const source = `${root}tmp/item-shop-${date}`;
const catalog = JSON.parse(await readFile(`${root}src/data/item-shop-catalog.json`, 'utf8'));
const input = [...new Map(catalog.groups.flatMap(group => group.items).map(item => [item.id, item])).values()];
await mkdir(`${output}/details`, {recursive: true});
await mkdir(source, {recursive: true});
const manifest = [];
let cursor = 0;
let completed = 0;

async function download(item) {
  const url = `https://www.dota2.com/datafeed/itemdata?language=russian&item_id=${item.id}`;
  let raw;
  let retrievedAt = date;
  if (process.argv.includes('--reuse-downloaded')) {
    for (const candidate of [...new Set([date, cacheDate].filter(Boolean))]) {
      try {
        raw = await readFile(`${root}tmp/item-shop-${candidate}/${item.id}.json`, 'utf8');
        retrievedAt = candidate;
        break;
      } catch (error) {if (error.code !== 'ENOENT') throw error;}
    }
  }
  if (!raw) {
    const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`${item.name}: HTTP ${response.status}`);
    raw = await response.text();
    await writeFile(`${source}/${item.id}.json`, raw);
  }
  const parsed = JSON.parse(raw).result?.data?.items?.[0];
  if (!parsed || parsed.id !== item.id || !parsed.is_item) throw new Error(`Missing item ${item.id}`);
  const data = {...itemDescription(parsed, retrievedAt), patchContext: catalog.patch, verification: 'imported'};
  await writeFile(`${output}/details/${item.id}.json`, JSON.stringify(data));
  manifest.push({id: item.id, source: url, retrievedAt, sha256: createHash('sha256').update(raw).digest('hex'), unresolved: data.unresolved});
}

await Promise.all(Array.from({length: 6}, async () => {
  while (cursor < input.length) {
    const item = input[cursor++];
    await download(item);
    completed++;
    if (completed % 40 === 0 || completed === input.length) console.log(`Imported ${completed}/${input.length}`);
  }
}));
await writeFile(`${source}/manifest.json`, JSON.stringify({assembledAt: date, locale: 'russian', items: manifest.sort((a,b) => a.id-b.id)}, null, 2));
const snapshot = {assembledAt: date, patchContext: catalog.patch, locale: 'russian', items: await Promise.all(manifest.map(async item => ({
  ...item, raw: await readFile(`${root}tmp/item-shop-${item.retrievedAt}/${item.id}.json`, 'utf8')
})))};
await writeFile(`${root}data-sources/valve-item-shop-${date}.json.gz`, gzipSync(JSON.stringify(snapshot), {level: 9}));
console.log(`Unresolved descriptions: ${manifest.filter(item => item.unresolved).map(item => item.id).join(', ') || 'none'}`);
