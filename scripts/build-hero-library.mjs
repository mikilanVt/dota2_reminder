import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {parseHeroList, parseHeroResponse, catalogEntry} from './hero-source-data.mjs';
import {heroDescription} from './hero-display-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = (await readdir(root + 'data-sources')).filter(file => /^valve-heroes-.*\.json\.gz$/.test(file)).sort();
const snapshot = JSON.parse(gunzipSync(await readFile(root + 'data-sources/' + files.at(-1))));
const images = JSON.parse(await readFile(root + 'data-sources/hero-images.json', 'utf8'));
const missing = new Set(images.assets.filter(asset => asset.missing).map(asset => asset.path));
const list = parseHeroList(snapshot.list.raw);
const output = root + 'public/assets/heroes/';
await mkdir(output + 'details', {recursive: true});
const metadata = {patch: snapshot.patchContext, retrievedAt: snapshot.assembledAt, verification: 'imported'};
const heroes = [], audit = [];
for (const entry of snapshot.heroes) {
  const expected = list.find(hero => hero.id === entry.id);
  if (!expected) throw new Error('Unknown snapshot hero: ' + entry.id);
  const hero = parseHeroResponse(entry.raw, expected);
  const card = heroDescription(hero, {...metadata, source: entry.source}, missing);
  await writeFile(output + `details/${hero.id}.json`, JSON.stringify(card));
  heroes.push({...catalogEntry(hero), attack: hero.attack_capability});
  for (const a of card.abilities) if (a.unresolved || a.upgrades.some(u => u.unresolved))
    audit.push({hero: card.key, ability: a.key, unresolved: a.unresolved, upgrades: a.upgrades.filter(u => u.unresolved)});
  for (const t of card.talents) if (t.unresolved) audit.push({hero: card.key, talent: t.key, text: t.text});
}
if (heroes.length !== list.length) throw new Error('Incomplete catalog');
await writeFile(output + 'catalog.json', JSON.stringify({...metadata,
  heroes: heroes.sort((a, b) => a.englishName.localeCompare(b.englishName, 'en'))}));
await writeFile(root + 'data-sources/hero-text-audit.json', JSON.stringify(audit, null, 2) + '\n');
console.log(`Built ${heroes.length} individual hero cards. ${audit.length} source text gaps recorded for review.`);
