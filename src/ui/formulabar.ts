import type { Spreadsheet } from '../spreadsheet';
import { a1ToRange, addressToA1 } from '../model/address';

/** Excel-style name box + formula bar. */
export class FormulaBar {
  readonly element: HTMLElement;
  readonly nameBox: HTMLInputElement;
  readonly input: HTMLTextAreaElement;

  constructor(private readonly sheet: Spreadsheet) {
    this.element = document.createElement('div');
    this.element.className = 'cui-formulabar';
    this.nameBox = document.createElement('input');
    this.nameBox.className = 'cui-namebox';
    this.nameBox.type = 'text';
    this.nameBox.setAttribute('aria-label', sheet.strings.nameBox);
    this.nameBox.spellcheck = false;
    const fx = document.createElement('div');
    fx.className = 'cui-fx';
    fx.textContent = 'fx';
    this.input = document.createElement('textarea');
    this.input.className = 'cui-formula-input';
    this.input.rows = 1;
    this.input.setAttribute('aria-label', sheet.strings.formulaBar);
    this.input.spellcheck = false;
    this.element.append(this.nameBox, fx, this.input);

    this.nameBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const range = a1ToRange(this.nameBox.value.trim());
        if (range) {
          sheet.model.ensureSize(range.end.row + 1, range.end.col + 1);
          sheet.grid.invalidateLayout();
          sheet.selection.selectRange(range, range.start);
          sheet.grid.scrollIntoView(range.start);
        }
        sheet.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        sheet.focus();
      }
    });
    this.nameBox.addEventListener('focus', () => this.nameBox.select());
    this.nameBox.addEventListener('blur', () => this.update());

    this.input.addEventListener('focus', () => {
      if (!sheet.isEditing) sheet.startEdit('formula');
      else sheet.setEditMode('formula');
    });
    this.input.addEventListener('input', () => {
      if (sheet.editMode === 'formula') sheet.setEditorText(this.input.value, { fromFormulaBar: true });
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.altKey) {
        e.preventDefault();
        if (sheet.commitEdit({ fillSelection: e.ctrlKey || e.metaKey })) {
          if (!(e.ctrlKey || e.metaKey)) sheet.enterMove(e.shiftKey ? -1 : 1);
        }
        sheet.focus();
      } else if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        const { selectionStart, selectionEnd, value } = this.input;
        this.input.value = value.slice(0, selectionStart) + '\n' + value.slice(selectionEnd);
        this.input.selectionStart = this.input.selectionEnd = selectionStart + 1;
        sheet.setEditorText(this.input.value, { fromFormulaBar: true });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (sheet.commitEdit()) sheet.tabMove(e.shiftKey ? -1 : 1);
        sheet.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        sheet.cancelEdit();
        sheet.focus();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
        // let the browser handle undo inside the text field
      }
    });
  }

  /** Mirror the current cell (or editor text) into the bar. */
  update(): void {
    const sheet = this.sheet;
    const sel = sheet.selection;
    if (sheet.activeElement !== this.nameBox) this.nameBox.value = addressToA1(sel.active);
    if (sheet.isEditing) {
      if (sheet.activeElement !== this.input) this.input.value = sheet.editorText;
    } else {
      this.input.value = sheet.editText(sel.active);
    }
  }

  destroy(): void {
    this.element.remove();
  }
}
