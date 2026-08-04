import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', `export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
`);
