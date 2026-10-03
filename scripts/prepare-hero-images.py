"""Build small, local WebP assets from Valve's static artwork; never fetch videos."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
import gzip
import json
import time
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
snapshots = sorted((ROOT / 'data-sources').glob('valve-heroes-*.json.gz'))
snapshot = json.loads(gzip.decompress(snapshots[-1].read_bytes()))
heroes = [json.loads(h['raw'])['result']['data']['heroes'][0] for h in snapshot['heroes']]
OUTPUT = ROOT / 'public/assets/heroes'
IMAGE = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react/'
RENDER = 'https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/'
tasks = {}
for hero in heroes:
    key = hero['name'].removeprefix('npc_dota_hero_')
    tasks[f'portraits/{key}.webp'] = (IMAGE + f'heroes/crops/{key}.png', (128, 192), 76, True)
    tasks[f'art/{key}.webp'] = (RENDER + key + '.png', (800, 800), 78, False)
    for ability in hero['abilities']:
        tasks[f'abilities/{ability["name"]}.webp'] = (IMAGE + f'abilities/{ability["name"]}.png', (80, 80), 78, False)
for attribute in ['strength', 'agility', 'intelligence', 'universal']:
    tasks[f'attributes/{attribute}.webp'] = (IMAGE + f'icons/hero_{attribute}.png', (48, 48), 85, False)

def prepare(task):
    name, (url, size, quality, crop) = task
    path = OUTPUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    error = None
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'DotaReminder-static-assets/1.0'}), timeout=45) as response:
                raw = response.read()
            with Image.open(BytesIO(raw)) as source:
                dimensions = source.size
                image = source.convert('RGBA')
                if crop:
                    image = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.35))
                else:
                    image.thumbnail(size, Image.Resampling.LANCZOS)
                image.save(path, 'WEBP', quality=quality, method=6)
            if path.stat().st_size > (160 * 1024 if name.startswith('art/') else 20 * 1024):
                raise ValueError('Image exceeds individual budget: ' + name)
            return {'path': name, 'source': url, 'sourceSize': dimensions, 'bytes': path.stat().st_size,
                    'sourceSha256': sha256(raw).hexdigest(), 'sha256': sha256(path.read_bytes()).hexdigest()}
        except Exception as problem:
            error = problem
            if attempt < 2:
                time.sleep(1 + attempt)
    raise RuntimeError(f'{name}: {error}')

with ThreadPoolExecutor(max_workers=4) as pool:
    manifest = list(pool.map(prepare, sorted(tasks.items())))
(ROOT / 'data-sources/hero-images.json').write_text(json.dumps({
    'retrievedAt': snapshot['assembledAt'], 'assets': manifest
}, ensure_ascii=False, separators=(',', ':')))
print(f'Prepared {len(manifest)} WebP images, {sum(a["bytes"] for a in manifest):,} bytes total.')
