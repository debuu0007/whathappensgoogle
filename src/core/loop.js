import * as THREE from 'three';

export function createLoop(update, render) {
  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;
  const frame = () => {
    if (!running) return;
    const delta = Math.min(clock.getDelta(), 1 / 30);
    update(delta, clock.elapsedTime);
    render(delta);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!running) { running = true; clock.start(); raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); clock.stop(); };
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  return { start, stop };
}
