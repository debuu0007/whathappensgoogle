import knowledge from './hops.json';
import ui from './ui.json';
import sceneHops from '../scene/hops.json';

function mergeHops() {
  const knowledgeByHop = new Map(knowledge.hops.map((hop) => [hop.id, hop]));
  return sceneHops.map((sceneHop) => {
    const copy = knowledgeByHop.get(sceneHop.id);
    if (!copy) throw new Error(`Missing knowledge for hop: ${sceneHop.id}`);
    const copyBySpot = new Map(copy.hotspots.map((spot) => [spot.id, spot]));
    return {
      ...sceneHop,
      title: copy.title,
      kicker: copy.kicker,
      sources: copy.sources,
      hotspots: sceneHop.hotspots.map((sceneSpot) => {
        const content = copyBySpot.get(sceneSpot.id);
        if (!content) throw new Error(`Missing knowledge for hotspot: ${sceneHop.id}/${sceneSpot.id}`);
        return { ...sceneSpot, ...content };
      }),
    };
  });
}

export const hops = mergeHops();
export { ui };
