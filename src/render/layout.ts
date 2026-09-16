/**
 * Prefix-sum layout for one axis (rows or columns) with variable sizes.
 * Offsets are recomputed lazily after `invalidate()`.
 */
export class AxisLayout {
  private offsets: number[] = [0];
  private dirty = true;

  constructor(
    private count: () => number,
    private sizeOf: (index: number) => number,
  ) {}

  invalidate(): void {
    this.dirty = true;
  }

  private ensure(): void {
    if (!this.dirty) return;
    const n = this.count();
    const offsets = new Array<number>(n + 1);
    offsets[0] = 0;
    for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + this.sizeOf(i);
    this.offsets = offsets;
    this.dirty = false;
  }

  get length(): number {
    this.ensure();
    return this.offsets.length - 1;
  }

  get total(): number {
    this.ensure();
    return this.offsets[this.offsets.length - 1];
  }

  offset(index: number): number {
    this.ensure();
    const i = Math.max(0, Math.min(this.offsets.length - 1, index));
    return this.offsets[i];
  }

  size(index: number): number {
    this.ensure();
    if (index < 0 || index >= this.offsets.length - 1) return 0;
    return this.offsets[index + 1] - this.offsets[index];
  }

  /** Index of the item containing pixel position `px` (clamped to the last item). */
  indexAt(px: number): number {
    this.ensure();
    const n = this.offsets.length - 1;
    if (n <= 0) return 0;
    if (px <= 0) return 0;
    if (px >= this.offsets[n]) return n - 1;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.offsets[mid] <= px) lo = mid;
      else hi = mid - 1;
    }
    // Skip zero-sized (hidden) items so that clicks land on a visible one.
    while (lo < n - 1 && this.offsets[lo + 1] === this.offsets[lo]) lo++;
    return lo;
  }

  /** Inclusive range of indices intersecting [from, to) pixels. */
  visibleRange(from: number, to: number): [number, number] {
    const n = this.length;
    if (n === 0) return [0, -1];
    const a = this.indexAt(from);
    const b = this.indexAt(Math.max(from, to - 1));
    return [a, Math.min(n - 1, Math.max(a, b))];
  }
}
