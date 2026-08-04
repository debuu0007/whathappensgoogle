import * as THREE from 'three';
import { gsap } from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
  constructor(camera, canvas, state, hops) {
    this.camera = camera; this.state = state; this.hops = hops;
    this.goalPos = camera.position.clone(); this.goalLook = new THREE.Vector3(0, 0, -4); this.look = this.goalLook.clone();
    this.rail = null; this.railT = { value: 0 }; this.focusBase = null;
    this.controls = new OrbitControls(camera, canvas);
    Object.assign(this.controls, { enabled: false, enablePan: false, minDistance: 2.5, maxDistance: 9, enableDamping: true, dampingFactor: .08 });
    this.controls.minPolarAngle = Math.PI / 3; this.controls.maxPolarAngle = Math.PI * 2 / 3;
    this.controls.minAzimuthAngle = -Math.PI / 6; this.controls.maxAzimuthAngle = Math.PI / 6;
    state.addEventListener('change', (event) => this.onState(event.detail));
  }
  onState({ value: s, reason }) {
    const hop = this.hops[s.hopIndex];
    this.controls.enabled = s.phase === 'FOCUSED' && !s.transitionLock;
    if (reason === 'START' || reason === 'GO_HOP') this.travel(hop, s.hopIndex);
    if (reason === 'FOCUS') this.focus(hop.hotspots.find((spot) => spot.id === s.focusedHotspot));
    if (reason === 'UNFOCUS') this.overview(hop, false);
    if (reason === 'FINISH') this.finale();
    if (reason === 'RESTORE') this.restore(hop, hop.hotspots.find((spot) => spot.id === s.focusedHotspot));
    if (reason === 'REPLAY') this.hero();
  }
  hero() {
    gsap.killTweensOf([this.goalPos, this.goalLook]);
    this.goalPos.set(0, 1.3, 13); this.goalLook.set(0, 0, -4); this.camera.fov = 50; this.camera.updateProjectionMatrix();
  }
  travel(hop, index) {
    this.controls.enabled = false; this.railT.value = 0;
    const start = this.camera.position.clone(); const end = new THREE.Vector3().fromArray(hop.overview.pos);
    const bend = new THREE.Vector3().addVectors(start, end).multiplyScalar(.5).add(new THREE.Vector3(index % 2 ? 5 : -5, 4, 0));
    this.rail = new THREE.CatmullRomCurve3([start, start.clone().lerp(bend, .55), bend, bend.clone().lerp(end, .55), end], false, 'catmullrom', .5);
    gsap.to(this.railT, { value: 1, duration: 1.55, ease: 'power2.inOut', overwrite: 'auto', onComplete: () => this.overview(hop, true) });
  }
  overview(hop, establishing) {
    const duration = establishing ? .6 : 1.2;
    gsap.to(this.goalPos, { x: hop.overview.pos[0], y: hop.overview.pos[1], z: hop.overview.pos[2], duration, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.goalLook, { x: hop.overview.lookAt[0], y: hop.overview.lookAt[1], z: hop.overview.lookAt[2], duration, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.camera, { fov: 50, duration, ease: 'power3.inOut', overwrite: 'auto', onUpdate: () => this.camera.updateProjectionMatrix(), onComplete: () => {
      const settle = () => this.state.send('SETTLED', { phase: 'OVERVIEW' });
      establishing ? gsap.delayedCall(2, settle) : settle();
    }});
  }
  focus(spot) {
    if (!spot) return;
    const duration = 1.25;
    gsap.to(this.goalPos, { x: spot.focus.pos[0], y: spot.focus.pos[1], z: spot.focus.pos[2], duration, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.goalLook, { x: spot.focus.lookAt[0], y: spot.focus.lookAt[1], z: spot.focus.lookAt[2], duration, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.camera, { fov: 42, duration, ease: 'power3.inOut', overwrite: 'auto', onUpdate: () => this.camera.updateProjectionMatrix(), onComplete: () => {
      this.controls.target.copy(this.goalLook); this.controls.update();
      const azimuth = this.controls.getAzimuthalAngle(); this.controls.minAzimuthAngle = azimuth - Math.PI / 6; this.controls.maxAzimuthAngle = azimuth + Math.PI / 6;
      this.state.send('SETTLED');
    }});
  }
  restore(hop, spot) {
    const pose = spot?.focus ?? hop.overview;
    this.goalPos.fromArray(pose.pos); this.goalLook.fromArray(pose.lookAt); this.look.copy(this.goalLook); this.camera.position.copy(this.goalPos);
    this.camera.fov = spot ? 42 : 50; this.camera.updateProjectionMatrix(); this.camera.lookAt(this.goalLook);
    this.controls.target.copy(this.goalLook); this.controls.update(); queueMicrotask(() => this.state.send('SETTLED', { phase: spot ? 'FOCUSED' : 'OVERVIEW' }));
  }
  finale() {
    this.controls.enabled = false;
    gsap.to(this.goalPos, { x: 0, y: 3.2, z: -80, duration: 1.1, ease: 'power4.inOut', overwrite: 'auto' });
    gsap.to(this.goalLook, { x: 0, y: 1, z: -85.3, duration: 1.1, ease: 'power4.inOut', overwrite: 'auto' });
    gsap.to(this.camera, { fov: 46, duration: 1.1, ease: 'power3.inOut', overwrite: 'auto', onUpdate: () => this.camera.updateProjectionMatrix() });
  }
  update(delta, elapsed) {
    if (this.rail && this.state.value.phase === 'TRAVELING') {
      const t = this.railT.value; const pos = this.rail.getPointAt(t); const ahead = this.rail.getPointAt(Math.min(t + .05, 1));
      this.goalPos.copy(pos); this.goalLook.copy(ahead);
    }
    if (this.controls.enabled) { this.controls.update(); this.goalPos.copy(this.camera.position); this.goalLook.copy(this.controls.target); return; }
    const driftX = Math.sin(elapsed * .47) * .05, driftY = Math.cos(elapsed * .31) * .035;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.goalPos.x + driftX, 12, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.goalPos.y + driftY, 12, delta);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.goalPos.z, 12, delta);
    this.look.x = THREE.MathUtils.damp(this.look.x, this.goalLook.x, 11, delta);
    this.look.y = THREE.MathUtils.damp(this.look.y, this.goalLook.y, 11, delta);
    this.look.z = THREE.MathUtils.damp(this.look.z, this.goalLook.z, 11, delta);
    this.camera.lookAt(this.look);
  }
  pose() { return { pos: this.camera.position.toArray().map((n) => +n.toFixed(2)), lookAt: this.look.toArray().map((n) => +n.toFixed(2)), fov: +this.camera.fov.toFixed(1) }; }
}
