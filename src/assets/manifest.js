import { buildDns, buildPlaceholder } from './procedural.js';

// The scene manager resolves every set-piece through this manifest. Supplying a
// `glb` later replaces its procedural counterpart without changing scene logic.
export const assetManifest = {
  BrowserDiorama: { procedural: (hop) => buildPlaceholder(hop, 0) },
  DnsDiorama: { procedural: buildDns },
  TcpDiorama: { procedural: (hop) => buildPlaceholder(hop, 2) },
  TlsDiorama: { procedural: (hop) => buildPlaceholder(hop, 3) },
  EdgeDiorama: { procedural: (hop) => buildPlaceholder(hop, 4) },
  ServerDiorama: { procedural: (hop) => buildPlaceholder(hop, 5) },
};

export const hopAssetIds = ['BrowserDiorama', 'DnsDiorama', 'TcpDiorama', 'TlsDiorama', 'EdgeDiorama', 'ServerDiorama'];
