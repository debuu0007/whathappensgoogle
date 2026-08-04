import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sourceUrl = new URL('src/content/hops.json', root);
const original = JSON.parse(await readFile(sourceUrl, 'utf8'));

const sceneHops = original.hops.map((hop) => ({
  id: hop.id,
  center: hop.center,
  overview: hop.overview,
  hotspots: hop.hotspots.map(({ id, anchorMesh, focus }) => ({
    id,
    anchorMesh,
    focus,
    story: `${hop.id}-${id}`,
  })),
}));

const knowledge = {
  version: 2,
  hops: original.hops.map((hop) => ({
    id: hop.id,
    title: hop.title,
    kicker: hop.kicker,
    sources: hop.sources,
    hotspots: hop.hotspots.map(({ id, modes, easy, real }) => ({
      id,
      modes,
      easy: {
        title: easy.title,
        summary: easy.body,
        sections: [],
        deeper: [],
        terms: {},
      },
      real: {
        title: real.title,
        summary: real.body,
        sections: [],
        deeper: [],
        terms: {},
        interviewLine: real.interviewLine,
      },
    })),
  })),
};

await mkdir(new URL('src/scene/', root), { recursive: true });
await writeFile(new URL('src/content/ui.json', root), `${JSON.stringify(original.ui, null, 2)}\n`);
await writeFile(new URL('src/scene/hops.json', root), `${JSON.stringify(sceneHops, null, 2)}\n`);
await writeFile(sourceUrl, `${JSON.stringify(knowledge, null, 2)}\n`);
