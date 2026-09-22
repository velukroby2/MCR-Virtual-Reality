/** Deterministic dwell selection. A held target fires once until released. */
export class GazeDwell {
  constructor(duration = 1.4, releaseDelay = .18) {
    this.duration = duration;
    this.releaseDelay = releaseDelay;
    this.reset();
  }
  reset() { this.key = null; this.elapsed = 0; this.latched = null; this.away = 0; }
  latch(key) { this.key = key; this.latched = key; this.elapsed = this.duration; this.away = 0; }
  update(key, delta, enabled = true) {
    const dt = Number.isFinite(delta) ? Math.min(.1, Math.max(0, delta)) : 0;
    if (!enabled) { this.reset(); return { progress: 0, triggered: false }; }
    if (!key) {
      this.away += dt;
      this.elapsed = 0;
      if (this.away >= this.releaseDelay) { this.key = null; this.latched = null; }
      return { progress: 0, triggered: false };
    }
    this.away = 0;
    if (this.key !== key) { this.key = key; this.elapsed = 0; this.latched = null; }
    if (this.latched === key) return { progress: 1, triggered: false };
    const duration = Math.max(.3, Number.isFinite(this.duration) ? this.duration : 1.4);
    this.elapsed += dt;
    if (this.elapsed + 1e-8 >= duration) {
      this.latched = key;
      return { progress: 1, triggered: true };
    }
    return { progress: Math.min(1, this.elapsed / duration), triggered: false };
  }
}
