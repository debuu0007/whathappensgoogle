import * as THREE from 'three';
import { gsap } from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
  constructor(camera, canvas, state, hops, scenes) {
    this.camera = camera; this.state = state; this.hops = hops; this.scenes = scenes;
    this.goalPos = camera.position.clone(); this.goalLook = new THREE.Vector3(0, 0, -4); this.look = this.goalLook.clone();
    this.travelTarget = new THREE.Vector3();
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
    if (reason === 'FOCUS') this.focus(s.hopIndex, hop.hotspots.find((spot) => spot.id === s.focusedHotspot));
    if (reason === 'UNFOCUS') { this.scenes.freezeSway(s.hopIndex, false); this.overview(hop, false); }
    if (reason === 'FINISH') this.finale();
    if (reason === 'RESTORE') this.restore(s.hopIndex, hop, hop.hotspots.find((spot) => spot.id === s.focusedHotspot));
    if (reason === 'REPLAY') this.hero();
  }
  hero() {
    gsap.killTweensOf([this.goalPos, this.goalLook]);
    this.goalPos.set(0, 1.3, 13); this.goalLook.set(0, 0, -4); this.camera.fov = 50; this.camera.updateProjectionMatrix();
  }
  travel(hop, index) {
    this.controls.enabled = false; this.railT.value = 0;
    this.travelTarget.fromArray(hop.center);
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
  computeFocusPose(hopIndex, spot) {
    const group = this.scenes.ensure(hopIndex);
    this.scenes.freezeSway(hopIndex, true);
    group?.updateWorldMatrix(true, true);
    const anchor = this.scenes.anchor(hopIndex, spot.anchorMesh);
    const box = new THREE.Box3();
    if (anchor) box.setFromObject(anchor, true);
    const sphere = new THREE.Sphere();
    if (!anchor || box.isEmpty()) {
      anchor?.getWorldPosition(sphere.center) ?? sphere.center.fromArray(this.hops[hopIndex].center);
      sphere.radius = .45;
    } else box.getBoundingSphere(sphere);
    sphere.radius = Math.max(sphere.radius, .35);
    const fov = spot.focus?.override ? (spot.focus.fov ?? 42) : 42;
    const vertical = THREE.MathUtils.degToRad(fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect);
    const distance = THREE.MathUtils.clamp((sphere.radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.35, 2.8, 12);
    const direction = new THREE.Vector3().fromArray(spot.viewDir ?? [0.72, .32, 1]).normalize();
    const position = sphere.center.clone().addScaledVector(direction, distance);
    if (spot.focus?.override) {
      position.fromArray(spot.focus.pos);
      sphere.center.fromArray(spot.focus.lookAt);
    }
    return { position, center: sphere.center.clone(), radius: sphere.radius, distance, fov };
  }
  focus(hopIndex, spot) {
    if (!spot) return;
    const pose = this.computeFocusPose(hopIndex, spot);
    const duration = 1.25;
    gsap.to(this.goalPos, { x: pose.position.x, y: pose.position.y, z: pose.position.z, duration, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.goalLook, { x: pose.center.x, y: pose.center.y, z: pose.center.z, duration, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(this.camera, { fov: pose.fov, duration, ease: 'power3.inOut', overwrite: 'auto', onUpdate: () => this.camera.updateProjectionMatrix(), onComplete: () => {
      this.controls.target.copy(this.goalLook); this.controls.update();
      this.controls.minDistance = Math.max(.8, pose.radius * 1.15); this.controls.maxDistance = Math.max(9, pose.distance * 1.8);
      const azimuth = this.controls.getAzimuthalAngle(); this.controls.minAzimuthAngle = azimuth - Math.PI / 6; this.controls.maxAzimuthAngle = azimuth + Math.PI / 6;
      this.state.send('SETTLED');
    }});
  }
  restore(hopIndex, hop, spot) {
    const pose = spot ? this.computeFocusPose(hopIndex, spot) : { position: new THREE.Vector3().fromArray(hop.overview.pos), center: new THREE.Vector3().fromArray(hop.overview.lookAt), fov: 50, radius: 1, distance: 6 };
    if (!spot) this.scenes.freezeSway(hopIndex, false);
    this.goalPos.copy(pose.position); this.goalLook.copy(pose.center); this.look.copy(this.goalLook); this.camera.position.copy(this.goalPos);
    this.camera.fov = pose.fov; this.camera.updateProjectionMatrix(); this.camera.lookAt(this.goalLook);
    if (spot) { this.controls.minDistance = Math.max(.8, pose.radius * 1.15); this.controls.maxDistance = Math.max(9, pose.distance * 1.8); }
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
      this.goalPos.copy(pos); this.goalLook.copy(ahead).lerp(this.travelTarget, THREE.MathUtils.smoothstep(t, .52, .94));
    }
    if (this.controls.enabled) { this.controls.update(); this.goalPos.copy(this.camera.position); this.goalLook.copy(this.controls.target); return; }
    const focused = this.state.value.phase === 'FOCUSED';
    const driftX = focused ? 0 : Math.sin(elapsed * .47) * .05, driftY = focused ? 0 : Math.cos(elapsed * .31) * .035;
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
