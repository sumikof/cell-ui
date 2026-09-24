# Keyboard Shortcuts

Shortcuts follow Excel's conventions. On macOS, use ⌘ instead of Ctrl (the `Mod` modifier in bindings). Every key can be remapped via `sheet.keymap` (see [Extensibility](./extensibility.md#keymap)).

## Navigation and selection

| Key | Action | Command |
| --- | --- | --- |
| ↑ ↓ ← → | Move | `nav.move` |
| Shift+Arrow | Extend the selection | `nav.move` (`extend`) |
| Ctrl+Arrow | Jump to the edge of the data (end of contiguous data → next data → edge of the sheet) | `nav.move` (`jump`) |
| Ctrl+Shift+Arrow | Select to the edge | `nav.move` (`jump`, `extend`) |
| Tab / Shift+Tab | Move right / left. With a multi-cell selection, cycles within the range | `nav.tab` |
| Enter / Shift+Enter | Move down / up. After moving with Tab, Enter returns to the column where the Tab sequence started. With a multi-cell selection, cycles within the range | `nav.enter` |
| Home / Shift+Home | Go to / select to the start of the row | `nav.home` |
| Ctrl+Home / Ctrl+Shift+Home | Go to / select to A1 | `nav.home` (`ctrl`) |
| Ctrl+End / Ctrl+Shift+End | Go to / select to the last used cell | `nav.end` |
| End / Shift+End | Go to the last data cell in the row | `nav.rowEnd` |
| PageUp / PageDown (+Shift) | Move one screen up / down | `nav.page` |
| Alt+PageUp / Alt+PageDown (+Shift) | Move one screen left / right | `nav.page` |
| Ctrl+A | Select the current region → press again to select all | `select.all` |
| Ctrl+Shift+Space | Select all | `select.all` (`force`) |
| Ctrl+Shift+* (Ctrl+Shift+8) | Select the current region | `select.currentRegion` |
| Shift+Space | Select the entire row | `select.row` |
| Ctrl+Space | Select the entire column (selects all if rows are selected) | `select.column` |

## Editing

| Key | Action | Command |
| --- | --- | --- |
| Character keys | Start typing (Enter mode) | – |
| F2 | Start editing (Edit mode). While editing, toggles between Enter mode and Edit mode | `edit.start` / `edit.toggleMode` |
| Enter / Shift+Enter | Commit and move down / up | `edit.commit` |
| Tab / Shift+Tab | Commit and move right / left | `edit.commit` |
| Ctrl+Enter | Commit and stay in place. With a multi-cell selection, enters the same value into every selected cell | `edit.commit` (`fillSelection`) |
| Alt+Enter | Line break within the cell | `edit.newline` |
| Esc | Cancel editing | `edit.cancel` |
| Delete | Clear the contents of the selection (formatting is kept) | `cell.clear` |
| Backspace | Clear the active cell and start editing | `cell.backspace` |
| Ctrl+; | Insert today's date | `insert.date` |
| Ctrl+: (Ctrl+Shift+;) | Insert the current time | `insert.time` |
| Alt+↓ | Open the validation (list) dropdown | `validation.openList` |

### Enter mode and Edit mode

As in Excel, the behavior of the arrow keys depends on how editing was started.

- **Enter mode** (editing started by typing a character): arrow keys commit and move.
- **Edit mode** (F2 / double-click / formula bar): arrow keys move the text cursor. Press F2 to switch modes.

Pressing Enter during IME composition (e.g. Japanese input) is not treated as a commit.

## Clipboard

| Key | Action | Command |
| --- | --- | --- |
| Ctrl+C / Ctrl+Insert | Copy (Excel-compatible TSV + HTML) | `clipboard.copy` |
| Ctrl+X / Shift+Delete | Cut (the source is cleared on paste; Esc cancels) | `clipboard.cut` |
| Ctrl+V / Shift+Insert | Paste (with formatting) | `clipboard.paste` |
| Ctrl+Shift+V | Paste values only | `clipboard.pasteValues` |
| Esc | Cancel cut | `clipboard.cancelCut` |

See [Clipboard](./clipboard.md) for details.

## Formatting

| Key | Action | Command |
| --- | --- | --- |
| Ctrl+B / Ctrl+2 | Bold | `format.toggle` (`bold`) |
| Ctrl+I / Ctrl+3 | Italic | `format.toggle` (`italic`) |
| Ctrl+U / Ctrl+4 | Underline | `format.toggle` (`underline`) |
| Ctrl+5 | Strikethrough | `format.toggle` (`strikethrough`) |
| Ctrl+Shift+& (Ctrl+Shift+7) | Outside border | `format.borders` (`outside`) |
| Ctrl+Shift+_ (Ctrl+Shift+-) | Remove borders | `format.borders` (`none`) |
| Ctrl+Shift+> / Ctrl+Shift+< | Increase / decrease font size | `format.fontSize` |
| Ctrl+1 | Format settings (focuses the toolbar) | `format.dialog` |

Formatting shortcuts also work while editing (`when: 'always'`).

## Fill, structure, and history

| Key | Action | Command |
| --- | --- | --- |
| Ctrl+D | Copy the cell above downward | `fill.down` |
| Ctrl+R | Copy the cell to the left rightward | `fill.right` |
| Ctrl++ | Insert rows (inserts columns when columns are selected) | `structure.insert` |
| Ctrl+- | Delete rows (deletes columns when columns are selected) | `structure.delete` |
| Ctrl+9 / Ctrl+Shift+9 | Hide / unhide rows | `rows.hide` / `rows.unhide` |
| Ctrl+0 / Ctrl+Shift+0 | Hide / unhide columns | `columns.hide` / `columns.unhide` |
| Ctrl+Z | Undo | `history.undo` |
| Ctrl+Y / Ctrl+Shift+Z | Redo | `history.redo` |

## Mouse actions

| Action | Result |
| --- | --- |
| Click / drag | Select. Shift+click extends. Dragging to the edge auto-scrolls |
| Double-click | Start editing in Edit mode |
| Click / drag on row numbers or column letters | Select entire rows / columns. The top-left corner selects all |
| Drag / double-click a header boundary | Resize / auto-fit |
| Drag the fill handle (bottom-right of the selection) | Copy series and patterns |
| Right-click | Context menu |
| ▾ button on a list cell | Validation dropdown |

## Key notation

Write bindings like `keymap.bind('Ctrl+Shift+ArrowDown', 'cmd')`. `Mod` is Ctrl on Windows/Linux and ⌘ on macOS. Special key names: `Enter` `Escape` `Tab` `Delete` `Backspace` `Space` `Plus` `Minus` `Home` `End` `PageUp` `PageDown` `ArrowUp` … `F1`–`F12`. Symbol keys (such as `;` and `:`) do not distinguish whether Shift is pressed, so they work across different keyboard layouts.
