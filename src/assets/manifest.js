import { buildBrowser, buildDns, buildEdge, buildServer, buildTcp, buildTls } from './procedural.js';

// The scene manager resolves every set-piece through this manifest. Supplying a
// `glb` later replaces its procedural counterpart without changing scene logic.
export const assetManifest = {
  BrowserDiorama: { procedural: buildBrowser },
  DnsDiorama: { procedural: buildDns },
  TcpDiorama: { procedural: buildTcp },
  TlsDiorama: { procedural: buildTls },
  EdgeDiorama: { procedural: buildEdge },
  ServerDiorama: { procedural: buildServer },
};

export const hopAssetIds = ['BrowserDiorama', 'DnsDiorama', 'TcpDiorama', 'TlsDiorama', 'EdgeDiorama', 'ServerDiorama'];
