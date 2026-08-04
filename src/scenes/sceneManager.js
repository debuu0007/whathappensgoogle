import * as THREE from 'three';
import { assetManifest, hopAssetIds } from '../assets/manifest.js';
import { gsap } from 'gsap';

export class SceneManager {
  constructor(scene, hops, renderer) {
    this.scene = scene;
    this.hops = hops;
    this.renderer = renderer;
    this.groups = new Array(hops.length).fill(null);
    this.currentStory = null;
    this.focusLight = new THREE.SpotLight(0x8eefff, 0, 18, Math.PI / 4, .9, 1.7);
    this.focusLight.castShadow = false; this.focusTarget = new THREE.Object3D(); this.focusLight.target = this.focusTarget;
    this.scene.add(this.focusLight, this.focusTarget);
    const routeCurve = new THREE.CatmullRomCurve3(hops.map((hop) => new THREE.Vector3().fromArray(hop.center).add(new THREE.Vector3(0, -1.35, 0))), false, 'catmullrom', .35);
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(routeCurve.getPoints(220));
    this.routeLine = new THREE.Line(routeGeometry, new THREE.LineBasicMaterial({ color: 0x50e9ff, transparent: true, opacity: .18, depthWrite: false }));
    this.routeLine.name = 'PersistentJourneyRoute'; this.scene.add(this.routeLine);
    this.ensure(0);
    this.setActive(-1);
  }
  ensure(index) {
    if (index < 0 || index >= this.hops.length) return null;
    if (this.groups[index]) return this.groups[index];
    const entry = assetManifest[hopAssetIds[index]];
    const group = entry.procedural(this.hops[index]);
    group.name = `Hop:${this.hops[index].id}`; group.position.fromArray(this.hops[index].center);
    group.traverse((node) => this.captureMaterialState(node));
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
      replacement.traverse((node) => this.captureMaterialState(node));
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
  materials(node) { return Array.isArray(node.material) ? node.material : [node.material]; }
  captureMaterialState(node) {
    if (!node.isMesh || !node.material) return;
    this.materials(node).forEach((material) => {
      material.userData.baseColor ??= material.color?.clone();
      material.userData.baseEmissive = material.emissiveIntensity ?? 0;
      material.userData.baseOpacity ??= material.opacity;
      material.userData.targetColor ??= material.color?.clone();
      material.userData.targetOpacity = material.userData.baseOpacity;
      material.userData.targetEmissive = material.userData.baseEmissive;
    });
  }
  isWithin(node, ancestor) {
    for (let current = node; current; current = current.parent) if (current === ancestor) return true;
    return false;
  }
  isEnvironment(node) {
    for (let current = node; current; current = current.parent) if (current.userData.environment) return true;
    return false;
  }
  freezeSway(hopIndex, frozen) {
    const group = this.ensure(hopIndex); if (!group) return;
    group.userData.freezeSway = frozen;
    if (frozen) { group.rotation.y = 0; group.updateWorldMatrix(true, true); }
  }
  setFocus(hopIndex, anchorName, storyId = null) {
    const active = this.groups[hopIndex]; if (!active) return;
    const storyKey = storyId ? `${hopIndex}:${storyId}` : null;
    if (storyKey !== this.currentStory) {
      this.groups.forEach((group) => group?.userData.stopStory?.());
      this.currentStory = storyKey;
    }
    const anchor = anchorName ? active.getObjectByName(anchorName) : null;
    active.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      const selected = !anchor || this.isWithin(node, anchor);
      const environment = !!anchor && !selected && this.isEnvironment(node);
      node.userData.highlight = !!anchor && selected;
      this.materials(node).forEach((material) => {
        const baseOpacity = material.userData.baseOpacity ?? 1;
        material.userData.targetOpacity = baseOpacity * (selected ? 1 : environment ? .68 : .48);
        material.userData.targetEmissive = (material.userData.baseEmissive ?? 0) * (selected ? 1.25 : environment ? .58 : .22);
        const base = material.userData.baseColor;
        if (!base || !material.color) return;
        const hsl = {}; base.getHSL(hsl);
        material.userData.targetColor.setHSL(hsl.h, hsl.s * (selected ? 1 : environment ? .5 : .16), hsl.l * (selected ? 1 : environment ? .76 : .64));
      });
    });
    if (anchor) {
      const box = new THREE.Box3().setFromObject(anchor, true); const center = new THREE.Vector3();
      box.isEmpty() ? anchor.getWorldPosition(center) : box.getCenter(center);
      this.focusTarget.position.copy(center); this.focusLight.position.copy(center).add(new THREE.Vector3(2.5, 4, 3));
      this.focusLight.userData.targetIntensity = 3.2;
    } else this.focusLight.userData.targetIntensity = 0;
    if (storyKey && storyKey === this.currentStory && active.userData.storyActive !== storyId) active.userData.playStory?.(storyId);
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
    this.focusLight.intensity = THREE.MathUtils.damp(this.focusLight.intensity, this.focusLight.userData.targetIntensity ?? 0, 7, _delta);
    this.groups.forEach((group, index) => {
      if (!group) return;
      if (!group.visible) return;
      if (!group.userData.freezeSway) group.rotation.y = Math.sin(elapsed * .18 + index) * .025;
      group.userData.update?.(_delta, elapsed);
      group.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const sceneDim = group.userData.dim ? .18 : 1;
        this.materials(node).forEach((material) => {
          const target = sceneDim * (material.userData.targetOpacity ?? material.userData.baseOpacity ?? 1);
          material.opacity = THREE.MathUtils.damp(material.opacity, target, 6, _delta);
          if (material.color && material.userData.targetColor) material.color.lerp(material.userData.targetColor, 1 - Math.exp(-6 * _delta));
          if ('emissiveIntensity' in material) {
            const base = material.userData.targetEmissive ?? material.userData.baseEmissive ?? 0;
            const breath = node.userData.highlight ? Math.max(.65, base) + (1 + Math.sin(elapsed * 3)) * .28 : base;
            material.emissiveIntensity = THREE.MathUtils.damp(material.emissiveIntensity, breath * sceneDim, 5, _delta);
          }
        });
      });
    });
  }
}
