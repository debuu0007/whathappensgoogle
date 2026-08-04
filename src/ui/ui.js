import * as THREE from 'three';

const q = (selector) => document.querySelector(selector);

export class UI {
  constructor(state, hops, camera, scenes) {
    this.state = state; this.hops = hops; this.camera = camera; this.scenes = scenes;
    this.hero = q('#hero'); this.heroBrowser = q('#hero-browser'); this.loader = q('#loader'); this.chapter = q('#chapter'); this.card = q('#info-card');
    this.hotspotLayer = q('#hotspots'); this.progress = q('#progress'); this.finale = q('#finale'); this.line = q('#leader-line');
    this.vector = new THREE.Vector3(); this.buttons = new Map();
    q('#start-button').addEventListener('click', () => state.send('START'));
    q('#replay-button').addEventListener('click', () => state.send('REPLAY'));
    q('#card-close').addEventListener('click', () => state.send('UNFOCUS'));
    q('#continue-button').addEventListener('click', () => this.next());
    q('#mode-toggle').addEventListener('click', () => state.send('SET_MODE', { mode: state.value.mode === 'easy' ? 'real' : 'easy' }));
    this.buildProgress(); this.bindKeyboard(); state.addEventListener('change', (event) => this.render(event.detail));
  }
  buildProgress() {
    this.progress.innerHTML = this.hops.map((hop, index) => `<button type="button" data-hop="${index}" aria-label="Go to ${hop.title.easy}"><i></i><span>${String(index + 1).padStart(2, '0')}</span><b>${hop.id}</b></button>`).join('');
    this.progress.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => this.state.send('GO_HOP', { index: +button.dataset.hop })));
  }
  bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      const s = this.state.value;
      if (event.key === 'Enter' && s.phase === 'HERO') this.state.send('START');
      if (event.key === 'Escape' && s.phase === 'FOCUSED') this.state.send('UNFOCUS');
      if (event.key === 'ArrowRight' && !s.transitionLock && !['HERO','FINALE'].includes(s.phase)) this.next();
      if (event.key === 'ArrowLeft' && !s.transitionLock && s.hopIndex > 0) this.state.send('GO_HOP', { index: s.hopIndex - 1 });
    });
  }
  next() { const s = this.state.value; s.hopIndex === this.hops.length - 1 ? this.state.send('FINISH') : this.state.send('GO_HOP', { index: s.hopIndex + 1 }); }
  render({ value: s }) {
    this.loader.classList.toggle('is-hidden', s.phase !== 'LOADING');
    this.hero.classList.toggle('is-hidden', s.phase !== 'HERO');
    this.heroBrowser.classList.toggle('is-hidden', s.phase !== 'HERO');
    this.finale.classList.toggle('is-hidden', s.phase !== 'FINALE');
    this.chapter.classList.toggle('is-hidden', ['LOADING','HERO','FINALE'].includes(s.phase));
    this.progress.classList.toggle('is-hidden', ['LOADING','HERO'].includes(s.phase));
    const hop = this.hops[s.hopIndex];
    q('#chapter-index').textContent = `${String(s.hopIndex + 1).padStart(2,'0')} / ${String(this.hops.length).padStart(2,'0')}`;
    q('#chapter-title').textContent = hop.title[s.mode]; q('#chapter-kicker').textContent = hop.kicker;
    q('#mode-toggle').setAttribute('aria-pressed', String(s.mode === 'real')); q('[data-mode-label]').textContent = s.mode === 'real' ? 'Interview mode' : 'Easy mode';
    this.progress.querySelectorAll('button').forEach((button, index) => button.classList.toggle('is-active', index === s.hopIndex));
    this.scenes.setActive(['HERO','LOADING'].includes(s.phase) ? -1 : s.hopIndex);
    this.renderHotspots(hop, s);
    const spot = hop.hotspots.find((item) => item.id === s.focusedHotspot);
    const showCard = s.phase === 'FOCUSED' && !s.transitionLock && spot;
    this.card.classList.toggle('is-open', !!showCard); this.card.setAttribute('aria-hidden', String(!showCard));
    if (showCard) this.populateCard(hop, spot, s.mode);
    if (s.phase === 'FINALE') this.playTimer();
    document.body.classList.toggle('is-returning', s.phase === 'FINALE' && s.transitionLock);
    document.body.classList.toggle('is-encrypted', s.hopIndex >= 3 && !['LOADING', 'HERO'].includes(s.phase));
  }
  renderHotspots(hop, s) {
    const visible = ['OVERVIEW','FOCUSED'].includes(s.phase) && !s.transitionLock;
    this.hotspotLayer.innerHTML = ''; this.buttons.clear();
    hop.hotspots.filter((spot) => spot.modes.includes(s.mode)).forEach((spot, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hotspot';
      button.innerHTML = `<i></i><span>${String(index + 1).padStart(2,'0')} · ${spot[s.mode].title}</span>`;
      button.setAttribute('aria-label', `Explore ${spot[s.mode].title}`); button.hidden = !visible;
      button.classList.toggle('is-active', s.focusedHotspot === spot.id);
      button.addEventListener('click', () => this.state.send('FOCUS', { id: spot.id }));
      this.hotspotLayer.append(button); this.buttons.set(spot.id, { button, spot });
    });
  }
  populateCard(hop, spot, mode) {
    q('#card-label').textContent = `${hop.title[mode]} · ${spot.id}`; q('#card-title').textContent = spot[mode].title; q('#card-body').textContent = spot[mode].body;
    const quote = q('#interview-line'); quote.hidden = mode !== 'real'; quote.textContent = mode === 'real' ? spot.real.interviewLine : '';
    q('#continue-button').innerHTML = this.state.value.hopIndex === this.hops.length - 1 ? 'See the result <span>→</span>' : 'Continue <span>→</span>';
  }
  updateAnchors() {
    const s = this.state.value; const hop = this.hops[s.hopIndex];
    this.buttons.forEach(({ button, spot }) => {
      const anchor = this.scenes.anchor(s.hopIndex, spot.anchorMesh); if (!anchor) return;
      const offset = anchor.userData.hotspotOffset;
      if (offset) { this.vector.fromArray(offset); anchor.localToWorld(this.vector); }
      else anchor.getWorldPosition(this.vector);
      this.vector.project(this.camera);
      const rawX = (this.vector.x * .5 + .5) * innerWidth, rawY = (-this.vector.y * .5 + .5) * innerHeight;
      const x = THREE.MathUtils.clamp(rawX, 24, innerWidth - 210);
      const y = THREE.MathUtils.clamp(rawY, 90, innerHeight - 110);
      button.style.transform = `translate3d(${x}px,${y}px,0)`; button.hidden = this.vector.z > 1 || s.transitionLock;
      if (spot.id === s.focusedHotspot && s.phase === 'FOCUSED' && !s.transitionLock) {
        const rect = this.card.getBoundingClientRect(); this.line.setAttribute('x1', x); this.line.setAttribute('y1', y); this.line.setAttribute('x2', rect.left); this.line.setAttribute('y2', rect.top + 68);
      }
    });
    q('#leader-layer').classList.toggle('is-visible', s.phase === 'FOCUSED' && !s.transitionLock);
  }
  playTimer() {
    const started = performance.now(); const node = q('#timer-value');
    const tick = (now) => { const t = Math.min((now - started) / 1300, 1); node.textContent = Math.round(250 * (1 - Math.pow(1 - t, 3))); if (t < 1 && this.state.value.phase === 'FINALE') requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
}
