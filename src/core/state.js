const PHASES = new Set(['LOADING', 'HERO', 'TRAVELING', 'OVERVIEW', 'FOCUSED', 'FINALE']);
const MODES = new Set(['easy', 'real']);

export class JourneyState extends EventTarget {
  constructor(hops) {
    super();
    this.hops = hops;
    this.value = Object.freeze({
      phase: 'LOADING', hopIndex: 0, focusedHotspot: null,
      mode: localStorage.getItem('packet-mode') === 'real' ? 'real' : 'easy',
      transitionLock: true,
    });
  }

  patch(next, reason = 'update') {
    const value = { ...this.value, ...next };
    if (!PHASES.has(value.phase) || !MODES.has(value.mode)) throw new Error('Invalid journey state');
    value.hopIndex = Math.max(0, Math.min(this.hops.length - 1, value.hopIndex));
    this.value = Object.freeze(value);
    if (next.mode) localStorage.setItem('packet-mode', next.mode);
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value, reason } }));
  }

  send(type, payload = {}) {
    const s = this.value;
    const retarget = type === 'FOCUS' && s.phase === 'FOCUSED';
    if (s.transitionLock && !retarget && !['READY', 'SETTLED', 'SET_MODE', 'RESTORE'].includes(type)) return false;
    switch (type) {
      case 'READY': this.patch({ phase: 'HERO', transitionLock: false }, type); break;
      case 'START': this.patch({ phase: 'TRAVELING', hopIndex: 0, focusedHotspot: null, transitionLock: true }, type); break;
      case 'GO_HOP': this.patch({ phase: 'TRAVELING', hopIndex: payload.index, focusedHotspot: null, transitionLock: true }, type); break;
      case 'FOCUS': this.patch({ phase: 'FOCUSED', focusedHotspot: payload.id, transitionLock: true }, type); break;
      case 'UNFOCUS': this.patch({ phase: 'OVERVIEW', focusedHotspot: null, transitionLock: true }, type); break;
      case 'SETTLED': this.patch({ ...payload, transitionLock: false }, type); break;
      case 'FINISH': this.patch({ phase: 'FINALE', focusedHotspot: null, transitionLock: true }, type); break;
      case 'REPLAY': this.patch({ phase: 'HERO', hopIndex: 0, focusedHotspot: null, transitionLock: false }, type); break;
      case 'SET_MODE': this.patch({ mode: payload.mode }, type); break;
      case 'RESTORE': this.patch(payload, type); break;
      default: return false;
    }
    return true;
  }
}
