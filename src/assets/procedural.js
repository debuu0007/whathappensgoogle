import * as THREE from 'three';

export const palette = { cyan: 0x50e9ff, cyanDark: 0x0d6b79, amber: 0xffb84d, blue: 0x4d79ff, ink: 0x0b111a, steel: 0x152332, violet: 0x866dff };

export function mat(color, emissive = color, intensity = .16, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: .4, metalness: .42, transparent: true, ...extras });
}

export function basic(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }); }

export function platform(radius = 5.4, color = palette.steel) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + .5, .45, 8), mat(color, 0x10263a, .1));
  base.position.y = -1.8; base.userData.environment = true; group.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + .04, .035, 5, 96), basic(palette.cyan, .45));
  ring.rotation.x = Math.PI / 2; ring.position.y = -1.55; ring.userData.environment = true; group.add(ring);
  return group;
}

function placeholder(hop, index) {
  const group = platform();
  const core = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 3.5), mat(index % 2 ? palette.cyan : palette.amber));
  core.name = hop.hotspots[0].anchorMesh; group.add(core);
  hop.hotspots.slice(1).forEach((spot, i) => {
    const marker = new THREE.Mesh(new THREE.IcosahedronGeometry(.7, 1), mat(i % 2 ? palette.cyan : palette.amber));
    marker.name = spot.anchorMesh; marker.position.set(Math.cos(i * 2.4) * 3.2, .4 + i, Math.sin(i * 2.4) * 2.4); group.add(marker);
  });
  return group;
}

function tower(name, height, color) {
  const group = new THREE.Group(); group.name = name; group.userData.hotspotOffset = [0, height + .45, 0];
  const levels = 4;
  for (let i = 0; i < levels; i++) {
    const scale = 1 - i * .11;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.8 * scale, 1.05 * scale, height / levels - .12, 6), mat(0x122435, color, .22));
    body.position.y = i * (height / levels) + (height / levels) / 2; group.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.92 * scale, .045, 5, 32), basic(color, .8));
    rim.rotation.x = Math.PI / 2; rim.position.y = (i + 1) * (height / levels) - .07; group.add(rim);
  }
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(.28, 0), mat(color, color, 2)); beacon.position.y = height + .45; group.add(beacon);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.025, .08, 2.8, 6, 1, true), basic(color, .15)); beam.position.y = height + 1.7; group.add(beam);
  return group;
}

function tubeBetween(a, b, color = palette.cyan) {
  const mid = a.clone().lerp(b, .5); mid.y += 1.2;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, .025, 5, false), basic(color, .32));
  return { tube, curve };
}

export function buildDns(hop) {
  const group = platform(6.7, 0x101d2b); group.userData.kind = 'dns';
  const resolver = tower('ResolverTower', 3.8, palette.cyan); resolver.position.set(-3.8, -1.55, 1.3);
  const root = tower('RootTower', 5.2, palette.amber); root.position.set(-.8, -1.55, -2.2);
  const tld = tower('TldTower', 4.3, palette.violet); tld.position.set(2.3, -1.55, -.5);
  const authoritative = tower('AuthoritativeTower', 5.7, palette.cyan); authoritative.position.set(3.7, -1.55, 2.2);
  group.add(resolver, root, tld, authoritative);
  const points = [resolver, root, tld, authoritative].map((item) => item.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
  const curves = [];
  for (let i = 0; i < points.length - 1; i++) { const { tube, curve } = tubeBetween(points[i], points[i + 1], i === 1 ? palette.violet : palette.cyan); group.add(tube); curves.push(curve); }
  const returnPath = new THREE.CatmullRomCurve3([...points, points[0]].map((p) => p.clone()));
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.24, 1), mat(palette.amber, palette.amber, 3)); orb.name = 'DnsQueryOrb'; group.add(orb);
  const answerRing = new THREE.Mesh(new THREE.TorusGeometry(.42, .055, 6, 28), basic(palette.amber, .9)); answerRing.rotation.x = Math.PI / 2; orb.add(answerRing);
  const local = new THREE.Group(); local.name = 'LocalLookup'; local.position.set(-5.2, -.7, -1.8); local.userData.hotspotOffset = [0, .7, 0];
  const layers = ['a','b','c'].map((_, i) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.25 - i * .1, .12, .8), mat(0x172b3d, i === 2 ? palette.amber : palette.cyan, .35)); mesh.position.y = i * .28; return mesh; });
  local.add(...layers); group.add(local);
  group.userData.update = (_delta, elapsed) => {
    const t = (elapsed * .085) % 1; orb.position.copy(returnPath.getPointAt(t)); orb.position.y += Math.sin(elapsed * 4) * .1;
    orb.rotation.x += _delta * 1.4; orb.rotation.y += _delta * 2;
    answerRing.scale.setScalar(.9 + Math.sin(elapsed * 3) * .12);
    [resolver, root, tld, authoritative].forEach((item, i) => { item.children.at(-2).rotation.y = elapsed * (.35 + i * .06); });
  };
  return group;
}

function hotspotGroup(name, position, offset = [0, 0, 0]) {
  const group = new THREE.Group(); group.name = name; group.position.copy(position); group.userData.hotspotOffset = offset; return group;
}

function glowOrb(name, color, radius = .28) {
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), mat(color, color, 2.4)); orb.name = name; orb.userData.hotspotOffset = [0, 0, 0]; return orb;
}

export function buildBrowser() {
  const group = platform(6.2, 0x111d29); group.userData.kind = 'browser';
  const frame = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4.6, .28), mat(0x121c28, palette.cyan, .12)); frame.position.set(0, .7, 0); frame.userData.environment = true; group.add(frame);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(7.05, 3.7), mat(0x071017, 0x062e36, .12)); screen.position.set(0, .45, .16); screen.userData.environment = true; group.add(screen);
  const parser = hotspotGroup('BrowserParser', new THREE.Vector3(-1.7, 1.35, .36), [0, .4, 0]);
  const urlParts = [1.25, 1.55, .95].map((width, index) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, .34, .14), mat(index === 1 ? palette.cyan : 0x36566b, index === 1 ? palette.cyan : 0x36566b, .45)); mesh.position.x = (index - 1) * 1.4; mesh.userData.home = mesh.position.x; parser.add(mesh); return mesh; }); group.add(parser);
  const cache = hotspotGroup('BrowserCache', new THREE.Vector3(2.35, -.15, .38), [0, .5, 0]);
  for (let i = 0; i < 3; i++) { const tray = new THREE.Mesh(new THREE.BoxGeometry(1.55, .18, 1.1), mat(0x172739, i === 2 ? palette.amber : palette.cyan, .25)); tray.position.y = i * .33; cache.add(tray); } group.add(cache);
  const hsts = hotspotGroup('HstsShield', new THREE.Vector3(0, -.45, .5), [0, .55, 0]); const shield = new THREE.Mesh(new THREE.CylinderGeometry(.58, .58, .15, 6), mat(palette.violet, palette.violet, .9)); shield.rotation.x = Math.PI / 2; hsts.add(shield); const keyhole = new THREE.Mesh(new THREE.OctahedronGeometry(.18), mat(palette.amber, palette.amber, 1.4)); keyhole.position.z = .12; hsts.add(keyhole); group.add(hsts);
  const socket = hotspotGroup('BrowserSocket', new THREE.Vector3(-2.7, -.45, .4), [0, .45, 0]); for (let i = 0; i < 4; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.28 + i * .13, .025, 5, 30), basic(palette.cyan, .6)); ring.rotation.x = Math.PI / 2; socket.add(ring); } group.add(socket);
  group.userData.update = (_delta, elapsed) => { urlParts.forEach((mesh, index) => { mesh.position.x = mesh.userData.home + Math.sin(elapsed * .7 + index) * .12; }); shield.rotation.z = elapsed * .18; };
  return group;
}

export function buildTcp() {
  const group = new THREE.Group(); group.userData.kind = 'tcp';
  const left = platform(3.2, 0x132334); left.position.x = -4.2; const right = platform(3.2, 0x132334); right.position.x = 4.2; group.add(left, right);
  const bridge = []; for (let i = 0; i < 3; i++) { const beam = new THREE.Mesh(new THREE.BoxGeometry(2.45, .28, 1.4), mat(0x203344, i === 2 ? palette.cyan : palette.amber, .5)); beam.position.set((i - 1) * 2.55, -.35, 0); group.add(beam); bridge.push(beam); }
  const syn = glowOrb('SynOrb', palette.amber); const synack = glowOrb('SynAckOrb', palette.cyan); const ack = glowOrb('AckOrb', palette.amber); group.add(syn, synack, ack);
  const socket = hotspotGroup('TcpSocketState', new THREE.Vector3(-4.4, .7, -1.5), [0, 1, 0]); for (let i = 0; i < 5; i++) { const column = new THREE.Mesh(new THREE.BoxGeometry(.22, .5 + i * .18, .22), mat(0x1b3448, i === 4 ? palette.cyan : palette.blue, .35)); column.position.x = (i - 2) * .35; socket.add(column); } group.add(socket);
  group.userData.update = (_delta, elapsed) => { const p = (elapsed * .22) % 1; syn.position.set(-4.2 + p * 4.4, 1 + Math.sin(p * Math.PI) * 1.4, 0); synack.position.set(4.2 - p * 4.4, 2 + Math.sin(p * Math.PI) * 1.1, .45); ack.position.set(-2.2 + p * 6.4, .6 + Math.sin(p * Math.PI) * .8, -.5); bridge.forEach((mesh, index) => { mesh.position.y = -.35 + Math.sin(elapsed * 1.2 - index * .5) * .05; }); };
  return group;
}

export function buildTls() {
  const group = platform(6, 0x101a2b); group.userData.kind = 'tls';
  const tunnel = hotspotGroup('EncryptedTunnel', new THREE.Vector3(0, .5, 0), [0, 1, 0]); for (let i = 0; i < 13; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, .055, 6, 36), basic(i % 3 === 0 ? palette.violet : palette.cyan, .35)); ring.position.z = (i - 6) * .62; ring.rotation.y = Math.PI / 2; tunnel.add(ring); } group.add(tunnel);
  const cert = hotspotGroup('CertificateSeal', new THREE.Vector3(-3.7, .25, 0), [0, 1.2, 0]); const seal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .18, 8), mat(palette.amber, palette.amber, .9)); seal.rotation.x = Math.PI / 2; cert.add(seal); const check = new THREE.Mesh(new THREE.TorusGeometry(.45, .09, 5, 28, Math.PI * 1.55), basic(0x071017)); check.position.z = .14; check.rotation.z = -.55; cert.add(check); group.add(cert);
  const keys = hotspotGroup('KeyExchange', new THREE.Vector3(3.4, .15, 1), [0, 1, 0]); for (let i = 0; i < 2; i++) { const key = new THREE.Mesh(new THREE.OctahedronGeometry(.55), mat(i ? palette.cyan : palette.violet, i ? palette.cyan : palette.violet, 1.2)); key.position.x = (i - .5) * 1.2; keys.add(key); } group.add(keys);
  const dial = hotspotGroup('CipherDial', new THREE.Vector3(3.7, .2, -2), [0, 1, 0]); for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.45 + i * .26, .035, 5, 36), basic(i === 2 ? palette.amber : palette.cyan, .65)); ring.rotation.x = Math.PI / 2; dial.add(ring); } group.add(dial);
  const armor = new THREE.Mesh(new THREE.DodecahedronGeometry(.65, 0), mat(0x173b50, palette.cyan, .75, { wireframe: true })); armor.position.set(0, .7, 0); tunnel.add(armor);
  group.userData.update = (_delta, elapsed) => { tunnel.children.forEach((ring, index) => { if (ring !== armor) ring.rotation.z = elapsed * (index % 2 ? .08 : -.08); }); seal.rotation.y = elapsed * .28; keys.children.forEach((key, index) => { key.rotation.y = elapsed * (index ? 1 : -1); }); dial.rotation.y = elapsed * .4; armor.rotation.y = elapsed * .7; }; return group;
}

export function buildEdge() {
  const group = platform(8.2, 0x0e1a26); group.userData.kind = 'edge';
  const rackGeo = new THREE.BoxGeometry(.48, 1.8, .72), rackMat = mat(0x132b3b, palette.cyan, .16); const racks = new THREE.InstancedMesh(rackGeo, rackMat, 112); racks.userData.environment = true; const matrix = new THREE.Matrix4(); let count = 0; for (let row = 0; row < 7; row++) for (let col = 0; col < 16; col++) { matrix.makeTranslation((col - 7.5) * .76, -.65, (row - 3) * 1.02); racks.setMatrixAt(count++, matrix); } racks.instanceMatrix.needsUpdate = true; group.add(racks);
  const streams = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.055, 0), mat(palette.cyan, palette.cyan, 1.8), 1800); streams.name = 'PacketStreams'; streams.userData.hotspotOffset = [0, 4, 0]; const seeds = new Float32Array(1800 * 3); for (let i = 0; i < 1800; i++) { seeds[i * 3] = (Math.random() - .5) * 13; seeds[i * 3 + 1] = Math.random() * 5 - 1; seeds[i * 3 + 2] = (Math.random() - .5) * 11; } streams.userData.seeds = seeds; group.add(streams);
  const beacon = hotspotGroup('AnycastBeacon', new THREE.Vector3(-5.3, .1, -3.5), [0, 3.8, 0]); const mast = new THREE.Mesh(new THREE.CylinderGeometry(.08, .25, 4.2, 6), mat(0x253b49, palette.cyan, .3)); mast.position.y = 1.2; beacon.add(mast); for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.75 + i * .5, .025, 5, 48), basic(palette.cyan, .35)); ring.rotation.x = Math.PI / 2; ring.position.y = 3.2; beacon.add(ring); } group.add(beacon);
  const balancer = hotspotGroup('LoadBalancer', new THREE.Vector3(4.6, .1, -2.7), [0, 2.2, 0]); const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), mat(palette.amber, palette.amber, .65)); hub.position.y = 1; balancer.add(hub); group.add(balancer);
  const termination = hotspotGroup('EdgeTermination', new THREE.Vector3(4.4, -.9, 2.7), [0, 1.4, 0]); const gate = new THREE.Mesh(new THREE.TorusGeometry(1.1, .15, 6, 40), mat(palette.violet, palette.violet, .75)); gate.rotation.y = Math.PI / 2; termination.add(gate); group.add(termination);
  let frame = 0; group.userData.update = (_delta, elapsed) => { frame++; if (frame % 2 === 0) { for (let i = 0; i < 1800; i++) { const offset = i * 3; matrix.makeTranslation(seeds[offset], ((seeds[offset + 1] + elapsed * (.8 + (i % 7) * .04) + 1) % 6) - 1, seeds[offset + 2]); streams.setMatrixAt(i, matrix); } streams.instanceMatrix.needsUpdate = true; } beacon.children.slice(1).forEach((ring, index) => ring.scale.setScalar(1 + Math.sin(elapsed * 1.4 + index) * .12)); hub.rotation.y = elapsed * .35; }; return group;
}

export function buildServer() {
  const group = platform(7, 0x111b28); group.userData.kind = 'server';
  const request = hotspotGroup('RequestParser', new THREE.Vector3(-3.9, .1, 1), [0, 1.4, 0]); for (let i = 0; i < 5; i++) { const slab = new THREE.Mesh(new THREE.BoxGeometry(1.8, .18, 1.2), mat(0x193248, i === 0 ? palette.amber : palette.cyan, .28)); slab.position.y = i * .3; request.add(slab); } group.add(request);
  const response = hotspotGroup('ResponseAssembler', new THREE.Vector3(3.8, .1, 1), [0, 1.5, 0]); for (let i = 0; i < 8; i++) { const part = new THREE.Mesh(new THREE.BoxGeometry(.45, .45, .45), mat(i % 3 === 0 ? palette.amber : 0x1a3a4b, i % 3 === 0 ? palette.amber : palette.cyan, .3)); part.position.set((i % 3 - 1) * .62, Math.floor(i / 3) * .58, 0); response.add(part); } group.add(response);
  const render = hotspotGroup('RenderTree', new THREE.Vector3(0, .1, -2), [0, 2, 0]); for (let i = 0; i < 7; i++) { const node = new THREE.Mesh(new THREE.IcosahedronGeometry(.22, 0), mat(i === 0 ? palette.amber : palette.cyan, i === 0 ? palette.amber : palette.cyan, .65)); node.position.set((i % 3 - 1) * 1.15, Math.floor(i / 3) * .85, 0); render.add(node); } group.add(render);
  const sub = hotspotGroup('SubresourceFan', new THREE.Vector3(-3.7, .1, -2.6), [0, 1.6, 0]); for (let i = 0; i < 6; i++) { const ray = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.6, .05), basic(i % 2 ? palette.violet : palette.cyan, .65)); ray.rotation.z = (i - 2.5) * .32; ray.position.y = .75; sub.add(ray); } group.add(sub);
  const page = new THREE.Group(); page.name = 'FinalePage'; page.position.set(0, 1.4, 2.7); page.rotation.x = -.18; const panel = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.5), mat(0xeef2f4, 0xffffff, .05)); panel.userData.finalPos = [0, 0, 0]; page.add(panel); const colors = [0x4285f4, 0xea4335, 0xfbbc05, 0x4285f4, 0x34a853, 0xea4335]; colors.forEach((color, index) => { const logo = new THREE.Mesh(new THREE.BoxGeometry(.48, .62, .08), mat(color, color, .18)); logo.position.set((index - 2.5) * .48, .8, .12); logo.userData.finalPos = logo.position.toArray(); page.add(logo); }); const search = new THREE.Mesh(new THREE.BoxGeometry(4.6, .48, .1), mat(0xffffff, 0x9bcbd3, .06)); search.position.set(0, -.15, .12); search.userData.finalPos = search.position.toArray(); page.add(search); for (let i = 0; i < 2; i++) { const button = new THREE.Mesh(new THREE.BoxGeometry(1.4, .36, .1), mat(0xdde3e6, 0x8fa9ae, .04)); button.position.set((i - .5) * 1.7, -.85, .12); button.userData.finalPos = button.position.toArray(); page.add(button); } page.visible = false; group.add(page); group.userData.finalePage = page;
  group.userData.update = (_delta, elapsed) => { request.rotation.y = Math.sin(elapsed * .8) * .06; response.children.forEach((part, index) => { part.position.z = Math.sin(elapsed * 1.4 + index) * .08; }); render.rotation.y = Math.sin(elapsed * .4) * .1; }; return group;
}

export function buildPlaceholder(hop, index) { return placeholder(hop, index); }
