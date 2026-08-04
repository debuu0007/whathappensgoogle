import * as THREE from 'three';

export const palette = { cyan: 0x50e9ff, cyanDark: 0x0d6b79, amber: 0xffb84d, blue: 0x4d79ff, ink: 0x0b111a, steel: 0x152332, violet: 0x866dff };

export function mat(color, emissive = color, intensity = .16, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: .4, metalness: .42, transparent: true, ...extras });
}

export function basic(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }); }

export function platform(radius = 5.4, color = palette.steel) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + .5, .45, 8), mat(color, 0x10263a, .1));
  base.position.y = -1.8; group.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + .04, .035, 5, 96), basic(palette.cyan, .45));
  ring.rotation.x = Math.PI / 2; ring.position.y = -1.55; group.add(ring);
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

export function buildPlaceholder(hop, index) { return placeholder(hop, index); }
