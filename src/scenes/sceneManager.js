import * as THREE from 'three';
import { assetManifest, hopAssetIds } from '../assets/manifest.js';

export class SceneManager {
  constructor(scene, hops) {
    this.scene = scene;
    this.hops = hops;
    this.groups = hops.map((hop, index) => {
      const group = assetManifest[hopAssetIds[index]].procedural(hop);
      group.name = `Hop:${hop.id}`; group.position.fromArray(hop.center);
      group.traverse((node) => { if (node.isMesh && node.material) { node.userData.baseEmissive = node.material.emissiveIntensity ?? 0; node.userData.targetOpacity = 1; } });
      scene.add(group); return group;
    });
    this.setActive(-1);
  }
  setActive(index) {
    this.groups.forEach((group, i) => { group.visible = index < 0 ? i === 0 : Math.abs(i - index) <= 1; group.userData.dim = i !== index; });
  }
  anchor(hopIndex, name) { return this.groups[hopIndex]?.getObjectByName(name); }
  setFocus(hopIndex, anchorName) {
    const active = this.groups[hopIndex]; if (!active) return;
    const anchor = anchorName ? active.getObjectByName(anchorName) : null;
    active.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      const selected = !anchor || node === anchor || anchor.children.includes(node) || node.parent === anchor;
      node.userData.targetOpacity = selected ? 1 : .22;
      node.userData.highlight = !!anchor && selected;
      node.material.depthWrite = selected;
    });
  }
  update(_delta, elapsed) {
    this.groups.forEach((group, index) => {
      if (!group.visible) return;
      group.rotation.y = Math.sin(elapsed * .18 + index) * .025;
      group.userData.update?.(_delta, elapsed);
      group.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const sceneDim = group.userData.dim ? .12 : 1;
        const target = sceneDim * (node.userData.targetOpacity ?? 1);
        node.material.opacity = THREE.MathUtils.damp(node.material.opacity, target, 6, _delta);
        if ('emissiveIntensity' in node.material) {
          const breath = node.userData.highlight ? .8 + (1 + Math.sin(elapsed * 3)) * .55 : (node.userData.baseEmissive ?? .12);
          node.material.emissiveIntensity = THREE.MathUtils.damp(node.material.emissiveIntensity, breath, 5, _delta);
        }
      });
    });
  }
}
