import {gzipSync} from 'node:zlib';
import {readdir, readFile, stat} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url));
const JS_GZIP_LIMIT = 150 * 1024;
const TOTAL_GZIP_LIMIT = 1024 * 1024;

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

for (const file of files) {
  const info = await stat(file);
  if (info.size === 0) continue;
  const content = await readFile(file);
  const gzipBytes = gzipSync(content, {level: 9}).byteLength;
  totalGzipBytes += gzipBytes;
  if (file.endsWith('.js')) jsGzipBytes += gzipBytes;
  console.log(`${relative(DIST_DIR, file)}: ${info.size} B raw / ${gzipBytes} B gzip`);
}

console.log(`JavaScript gzip total: ${jsGzipBytes} B / limit ${JS_GZIP_LIMIT} B`);
console.log(`All build files gzip total: ${totalGzipBytes} B / limit ${TOTAL_GZIP_LIMIT} B`);

if (jsGzipBytes > JS_GZIP_LIMIT)
  throw new Error('Initial JavaScript budget exceeded.');
if (totalGzipBytes > TOTAL_GZIP_LIMIT)
  throw new Error('Initial transfer budget exceeded.');
