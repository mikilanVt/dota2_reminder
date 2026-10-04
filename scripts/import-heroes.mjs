import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {parseHeroList, parseHeroResponse, catalogEntry} from './hero-source-data.mjs';

// Import is a development operation. The application never calls Valve's API.
const patch = process.argv.find(argument => argument.startsWith('--patch='))?.slice(8);
if (!patch || !/^\d+\.\d+[a-z]?$/.test(patch))
  throw new Error('Specify the independently checked patch, e.g. --patch=7.41e');
const root = fileURLToPath(new URL('../', import.meta.url));
const date = new Date().toISOString().slice(0, 10);
const directory = root + 'tmp/heroes-import-' + date;
const reuse = process.argv.includes('--reuse-downloaded');
await mkdir(directory, {recursive: true});
const sha256 = raw => createHash('sha256').update(raw).digest('hex');
async function download(name, url) {
  const path = directory + '/' + name + '.json';
  if (reuse) {
    try {return await readFile(path, 'utf8');}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
  const raw = await response.text();
  JSON.parse(raw);
  await writeFile(path, raw);
  return raw;
}
const listUrl = 'https://www.dota2.com/datafeed/herolist?language=russian';
const listRaw = await download('list', listUrl);
const heroes = parseHeroList(listRaw);
const entries = new Array(heroes.length);
let cursor = 0;
let failed = false;
const workers = await Promise.allSettled(Array.from({length: 4}, async () => {
  while (!failed && cursor < heroes.length) {
    const index = cursor++;
    const expected = heroes[index];
    try {
      const source = 'https://www.dota2.com/datafeed/herodata?language=russian&hero_id=' + expected.id;
      const raw = await download(String(expected.id), source);
      parseHeroResponse(raw, expected);
      entries[index] = {id: expected.id, source, retrievedAt: date, sha256: sha256(raw), raw};
    } catch (error) {failed = true; throw error;}
  }
}));
const failure = workers.find(worker => worker.status === 'rejected');
if (failure) throw failure.reason;
if (entries.filter(Boolean).length !== heroes.length) throw new Error('Incomplete hero snapshot');
const snapshot = {
  assembledAt: date, patchContext: patch, locale: 'russian', verification: 'imported',
  list: {source: listUrl, retrievedAt: date, sha256: sha256(listRaw), raw: listRaw},
  heroes: entries
};
// Publish neither partial downloads nor live data under a guessed patch label.
// Raw source stays outside public/ and is never included in the site bundle.
await writeFile(root + 'data-sources/valve-heroes-' + date + '.json.gz',
  gzipSync(JSON.stringify(snapshot), {level: 9}));
await writeFile(root + 'src/data/hero-catalog.json', JSON.stringify({
  patch, retrievedAt: date, source: listUrl, verification: 'imported',
  heroes: heroes.map(catalogEntry).sort((a, b) => a.englishName.localeCompare(b.englishName, 'en'))
}));
console.log('Imported ' + heroes.length + ' heroes; source snapshot and compact catalog written.');
console.log('Next: review transformed ability text, prepare WebP assets, run npm run verify.');
