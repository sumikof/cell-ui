import type { Keymap } from '../keyboard/keymap';

/**
 * Excel's keyboard shortcuts. Every entry maps to a command id; applications
 * can rebind with `sheet.keymap.bind()` / `unbind()`.
 */
export function installDefaultKeymap(keymap: Keymap): void {
  const dirs: [string, number, number][] = [
    ['ArrowUp', -1, 0],
    ['ArrowDown', 1, 0],
    ['ArrowLeft', 0, -1],
    ['ArrowRight', 0, 1],
  ];
  for (const [key, dRow, dCol] of dirs) {
    keymap.bind(key, 'nav.move', { args: { dRow, dCol } });
    keymap.bind(`Shift+${key}`, 'nav.move', { args: { dRow, dCol, extend: true } });
    keymap.bind(`Mod+${key}`, 'nav.move', { args: { dRow, dCol, jump: true } });
    keymap.bind(`Mod+Shift+${key}`, 'nav.move', { args: { dRow, dCol, jump: true, extend: true } });
    // While editing in "Enter" mode (started by typing) arrows commit and move, like Excel.
    keymap.bind(key, 'edit.arrow', { when: 'edit', args: { dRow, dCol } });
  }
  keymap.bind('Tab', 'nav.tab');
  keymap.bind('Shift+Tab', 'nav.tab', { args: { back: true } });
  keymap.bind('Enter', 'nav.enter');
  keymap.bind('Shift+Enter', 'nav.enter', { args: { back: true } });
  keymap.bind('Home', 'nav.home');
  keymap.bind('Shift+Home', 'nav.home', { args: { extend: true } });
  keymap.bind('Mod+Home', 'nav.home', { args: { ctrl: true } });
  keymap.bind('Mod+Shift+Home', 'nav.home', { args: { ctrl: true, extend: true } });
  keymap.bind('Mod+End', 'nav.end');
  keymap.bind('Mod+Shift+End', 'nav.end', { args: { extend: true } });
  keymap.bind('End', 'nav.rowEnd');
  keymap.bind('Shift+End', 'nav.rowEnd', { args: { extend: true } });
  keymap.bind('PageDown', 'nav.page', { args: { dRow: 1 } });
  keymap.bind('PageUp', 'nav.page', { args: { dRow: -1 } });
  keymap.bind('Shift+PageDown', 'nav.page', { args: { dRow: 1, extend: true } });
  keymap.bind('Shift+PageUp', 'nav.page', { args: { dRow: -1, extend: true } });
  keymap.bind('Alt+PageDown', 'nav.page', { args: { dCol: 1 } });
  keymap.bind('Alt+PageUp', 'nav.page', { args: { dCol: -1 } });
  keymap.bind('Alt+Shift+PageDown', 'nav.page', { args: { dCol: 1, extend: true } });
  keymap.bind('Alt+Shift+PageUp', 'nav.page', { args: { dCol: -1, extend: true } });

  keymap.bind('Mod+A', 'select.all');
  keymap.bind(['Mod+Shift+8', 'Mod+*'], 'select.currentRegion');
  keymap.bind('Shift+Space', 'select.row');
  keymap.bind('Mod+Space', 'select.column');
  keymap.bind('Mod+Shift+Space', 'select.all', { args: { force: true } });

  keymap.bind('F2', 'edit.start');
  keymap.bind('F2', 'edit.toggleMode', { when: 'edit' });
  keymap.bind('Enter', 'edit.commit', { when: 'edit', args: { dRow: 1 } });
  keymap.bind('Shift+Enter', 'edit.commit', { when: 'edit', args: { dRow: -1 } });
  keymap.bind('Tab', 'edit.commit', { when: 'edit', args: { dCol: 1 } });
  keymap.bind('Shift+Tab', 'edit.commit', { when: 'edit', args: { dCol: -1 } });
  keymap.bind('Mod+Enter', 'edit.commit', { when: 'edit', args: { fillSelection: true } });
  keymap.bind('Alt+Enter', 'edit.newline', { when: 'edit' });
  keymap.bind('Escape', 'edit.cancel', { when: 'edit' });
  keymap.bind('Escape', 'clipboard.cancelCut');
  keymap.bind('Delete', 'cell.clear');
  keymap.bind('Backspace', 'cell.backspace');

  keymap.bind('Mod+C', 'clipboard.copy');
  keymap.bind('Mod+Insert', 'clipboard.copy');
  keymap.bind('Mod+X', 'clipboard.cut');
  keymap.bind('Shift+Delete', 'clipboard.cut');
  keymap.bind('Mod+V', 'clipboard.paste');
  keymap.bind('Shift+Insert', 'clipboard.paste');
  keymap.bind('Mod+Shift+V', 'clipboard.pasteValues');

  keymap.bind('Mod+Z', 'history.undo', { when: 'always' });
  keymap.bind(['Mod+Y', 'Mod+Shift+Z'], 'history.redo', { when: 'always' });

  keymap.bind(['Mod+B', 'Mod+2'], 'format.toggle', { when: 'always', args: 'bold' });
  keymap.bind(['Mod+I', 'Mod+3'], 'format.toggle', { when: 'always', args: 'italic' });
  keymap.bind(['Mod+U', 'Mod+4'], 'format.toggle', { when: 'always', args: 'underline' });
  keymap.bind('Mod+5', 'format.toggle', { when: 'always', args: 'strikethrough' });
  keymap.bind('Mod+Shift+7', 'format.borders', { args: 'outside' }); // Ctrl+Shift+&
  keymap.bind('Mod+Shift+-', 'format.borders', { args: 'none' }); // Ctrl+Shift+_
  keymap.bind('Mod+Shift+.', 'format.fontSize', { args: 1 }); // Ctrl+Shift+>
  keymap.bind('Mod+Shift+,', 'format.fontSize', { args: -1 }); // Ctrl+Shift+<
  keymap.bind('Mod+1', 'format.dialog');

  keymap.bind('Mod+D', 'fill.down');
  keymap.bind('Mod+R', 'fill.right');

  keymap.bind('Mod+Plus', 'structure.insert');
  keymap.bind('Mod+Minus', 'structure.delete');
  keymap.bind('Mod+9', 'rows.hide');
  keymap.bind('Mod+Shift+9', 'rows.unhide');
  keymap.bind('Mod+0', 'columns.hide');
  keymap.bind('Mod+Shift+0', 'columns.unhide');

  keymap.bind('Alt+ArrowDown', 'validation.openList');

  keymap.bind('Mod+;', 'insert.date');
  keymap.bind('Mod+Shift+:', 'insert.time');
  keymap.bind('Mod+:', 'insert.time');
  keymap.bind('Mod+Shift+;', 'insert.time');
}
