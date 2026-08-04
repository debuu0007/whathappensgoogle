import * as THREE from 'three';
import { assetManifest, hopAssetIds } from '../assets/manifest.js';
import { gsap } from 'gsap';

export class SceneManager {
  constructor(scene, hops, renderer) {
    this.scene = scene;
    this.hops = hops;
    this.renderer = renderer;
    this.groups = new Array(hops.length).fill(null);
    this.ensure(0);
    this.setActive(-1);
  }
  ensure(index) {
    if (index < 0 || index >= this.hops.length) return null;
    if (this.groups[index]) return this.groups[index];
    const entry = assetManifest[hopAssetIds[index]];
    const group = entry.procedural(this.hops[index]);
    group.name = `Hop:${this.hops[index].id}`; group.position.fromArray(this.hops[index].center);
    group.traverse((node) => { if (node.isMesh && node.material) { node.userData.baseEmissive = node.material.emissiveIntensity ?? 0; node.userData.targetOpacity = 1; } });
    this.scene.add(group); this.groups[index] = group;
    if (entry.glb) this.upgradeToGlb(index, entry, group);
    return group;
  }
  async upgradeToGlb(index, entry, fallback) {
    try {
      const { createAssetLoader } = await import('../assets/loaders.js');
      this.assetLoader ??= createAssetLoader(this.renderer);
      const { scene: replacement } = await this.assetLoader.gltf.loadAsync(entry.glb);
      replacement.name = fallback.name; replacement.position.copy(fallback.position); replacement.visible = fallback.visible; replacement.userData.dim = fallback.userData.dim;
      replacement.traverse((node) => { if (node.isMesh && node.material) { node.userData.baseEmissive = node.material.emissiveIntensity ?? 0; node.userData.targetOpacity = 1; } });
      this.scene.add(replacement); this.scene.remove(fallback); fallback.traverse((node) => { node.geometry?.dispose?.(); node.material?.dispose?.(); }); this.groups[index] = replacement;
    } catch (error) { console.warn(`Procedural fallback retained for ${this.hops[index].id}`, error); }
  }
  setActive(index) {
    this.ensure(index < 0 ? 0 : index);
    if (index >= 0) { this.ensure(index - 1); window.setTimeout(() => this.ensure(index + 1), 250); }
    this.groups.forEach((group, i) => { if (!group) return; group.visible = index < 0 ? i === 0 : Math.abs(i - index) <= 1; group.userData.dim = i !== index; });
    if (index >= 2 && matchMedia('(max-width: 700px)').matches) {
      const disposeIndex = index - 2; const stale = this.groups[disposeIndex];
      if (stale) { stale.traverse((node) => { node.geometry?.dispose?.(); if (Array.isArray(node.material)) node.material.forEach((item) => item.dispose()); else node.material?.dispose?.(); }); this.scene.remove(stale); this.groups[disposeIndex] = null; }
    }
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
  playFinale() {
    this.setActive(5);
    const page = this.ensure(5)?.userData.finalePage;
    if (!page) return;
    page.visible = true;
    page.children.forEach((piece, index) => {
      const final = piece.userData.finalPos ?? piece.position.toArray();
      piece.position.set(final[0] + (index % 2 ? 7 : -7), final[1] + 4 + index * .2, final[2] + 2);
      piece.rotation.z = (index % 2 ? 1 : -1) * .9;
      piece.scale.setScalar(.2);
      gsap.to(piece.position, { x: final[0], y: final[1], z: final[2], duration: .8, delay: .55 + index * .1, ease: 'power3.out' });
      gsap.to(piece.rotation, { z: 0, duration: .8, delay: .55 + index * .1, ease: 'power3.out' });
      gsap.to(piece.scale, { x: 1, y: 1, z: 1, duration: .65, delay: .55 + index * .1, ease: 'back.out(1.4)' });
    });
  }
  update(_delta, elapsed) {
    this.groups.forEach((group, index) => {
      if (!group) return;
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
