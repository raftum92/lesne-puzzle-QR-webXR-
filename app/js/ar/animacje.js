// Animacje liczone w pętli rysowania AR: w czasie sesji nie można polegać na window.requestAnimationFrame.

const REDUCED_MS = 300; // tyle najwyżej trwa animacja przy prefers-reduced-motion, jak w gra.js

export class Animator {
  constructor({ reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    this.running = new Set();
  }

  // Obietnica daje true po końcu animacji albo false, gdy przerwało ją clear().
  add(ms, onUpdate, ease = (k) => k) {
    const duration = this.reducedMotion ? Math.min(ms, REDUCED_MS) : ms;
    return new Promise((resolve) => {
      this.running.add({ duration, onUpdate, ease, resolve, start: null });
    });
  }

  update(now) {
    for (const item of this.running) {
      item.start ??= now;
      const k = item.duration > 0 ? Math.min(1, (now - item.start) / item.duration) : 1;
      item.onUpdate(item.ease(k));
      if (k === 1) {
        this.running.delete(item);
        item.resolve(true);
      }
    }
  }

  clear() {
    for (const item of this.running) item.resolve(false);
    this.running.clear();
  }
}
