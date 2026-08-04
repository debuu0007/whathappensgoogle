import * as THREE from 'three';

const cyan = 0x50e9ff;
const amber = 0xffb84d;

function material(color, emissive = color) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: .16, roughness: .42, metalness: .38, transparent: true });
}

function placeholder(hop, index) {
  const group = new THREE.Group();
  group.name = `Hop:${hop.id}`;
  group.position.fromArray(hop.center);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, .45, 6), material(0x101b2a, 0x12263d));
  base.position.y = -1.8; group.add(base);
  const core = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 3.5), material(index % 2 ? cyan : amber));
  core.name = hop.hotspots[0].anchorMesh; group.add(core);
  hop.hotspots.slice(1).forEach((spot, i) => {
    const marker = new THREE.Mesh(new THREE.IcosahedronGeometry(.7, 1), material(i % 2 ? cyan : amber));
    marker.name = spot.anchorMesh;
    marker.position.set(Math.cos(i * 2.4) * 3.2, .4 + i, Math.sin(i * 2.4) * 2.4);
    group.add(marker);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, .035, 6, 80), new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: .25 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -1.53; group.add(ring);
  return group;
}

export class SceneManager {
  constructor(scene, hops) {
    this.scene = scene;
    this.hops = hops;
    this.groups = hops.map((hop, index) => {
      const group = placeholder(hop, index); scene.add(group); return group;
    });
    this.setActive(-1);
  }
  setActive(index) {
    this.groups.forEach((group, i) => { group.visible = index < 0 ? i === 0 : Math.abs(i - index) <= 1; group.userData.dim = i !== index; });
  }
  anchor(hopIndex, name) { return this.groups[hopIndex]?.getObjectByName(name); }
  update(_delta, elapsed) {
    this.groups.forEach((group, index) => {
      if (!group.visible) return;
      group.rotation.y = Math.sin(elapsed * .18 + index) * .035;
      group.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const dim = group.userData.dim ? .16 : 1;
        node.material.opacity = THREE.MathUtils.damp(node.material.opacity, dim, 5, _delta);
        if ('emissiveIntensity' in node.material) node.material.emissiveIntensity = .14 + (1 + Math.sin(elapsed * 2 + index)) * .1;
      });
    });
  }
}
