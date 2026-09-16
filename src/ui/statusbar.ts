import type { Spreadsheet } from '../spreadsheet';
import { iterateRange, rangeSize } from '../model/address';
import { formatNumber } from '../model/value';

/** Shows Excel-like quick statistics for the selection (Average / Count / Sum). */
export class StatusBar {
  readonly element: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly custom: HTMLElement;

  constructor(private readonly sheet: Spreadsheet) {
    this.element = document.createElement('div');
    this.element.className = 'cui-statusbar';
    this.custom = document.createElement('div');
    this.custom.className = 'cui-status-custom';
    this.stats = document.createElement('div');
    this.stats.className = 'cui-status-stats';
    this.element.append(this.custom, this.stats);
  }

  /** Slot for application-specific status content. */
  get customSlot(): HTMLElement {
    return this.custom;
  }

  update(): void {
    const sheet = this.sheet;
    const range = sheet.selection.range;
    const { rows, cols } = rangeSize(range);
    if (rows * cols > 200000) {
      this.stats.textContent = '';
      return;
    }
    let count = 0;
    let numCount = 0;
    let sum = 0;
    const model = sheet.model;
    if (rows * cols > model.cellCount * 4) {
      for (const [addr, data] of model.entries()) {
        if (addr.row < range.start.row || addr.row > range.end.row || addr.col < range.start.col || addr.col > range.end.col) continue;
        if (data.value === null || data.value === '') continue;
        count++;
        if (typeof data.value === 'number') {
          numCount++;
          sum += data.value;
        }
      }
    } else {
      for (const addr of iterateRange(range)) {
        const v = model.getValue(addr.row, addr.col);
        if (v === null || v === '') continue;
        count++;
        if (typeof v === 'number') {
          numCount++;
          sum += v;
        }
      }
    }
    const t = sheet.strings;
    const parts: string[] = [];
    if (count > 1) {
      if (numCount > 0) parts.push(`${t.average}: ${formatNumber(sum / numCount)}`);
      parts.push(`${t.count}: ${count}`);
      if (numCount > 0) parts.push(`${t.sum}: ${formatNumber(sum)}`);
    }
    this.stats.textContent = parts.join('    ');
  }

  destroy(): void {
    this.element.remove();
  }
}
