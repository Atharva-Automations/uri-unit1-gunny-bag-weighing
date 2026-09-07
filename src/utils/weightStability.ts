export const STABLE_DURATION_MS = 5000;
export const WEIGHT_TOLERANCE_KG = 0.005;
export const MAX_READING_AGE_MS = 2000;

/** Tracks the full weight range, not just consecutive differences (which allow drift). */
export class WeightStability {
  private start: number | null = null;
  private lastSample = 0;
  private min = 0;
  private max = 0;

  reset() {
    this.start = null;
    this.lastSample = 0;
  }

  update(weight: number, at: number, now: number): boolean {
    if (!Number.isFinite(weight) || weight <= WEIGHT_TOLERANCE_KG ||
        !Number.isFinite(at) || now - at > MAX_READING_AGE_MS || at > now + 1000) {
      this.reset();
      return false;
    }
    if (at <= this.lastSample) return false;
    const gap = at - this.lastSample;
    this.lastSample = at;
    const min = Math.min(this.min, weight);
    const max = Math.max(this.max, weight);
    if (this.start === null || gap > MAX_READING_AGE_MS || max - min > WEIGHT_TOLERANCE_KG + 1e-9) {
      this.start = at;
      this.min = weight;
      this.max = weight;
      return false;
    }
    this.min = min;
    this.max = max;
    return at - this.start >= STABLE_DURATION_MS;
  }
}
