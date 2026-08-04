import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/three/examples/jsm/libs/basis');
const target = resolve(root, 'public/basis');
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
