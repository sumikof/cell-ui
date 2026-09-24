# Extensibility (Plugin API)

The cell-ui core focuses solely on the "cell UI"; functions (formulas), input assistance, custom formatting, and so on are designed to be plugged in from outside. Every operation is registered as a command, and you can extend cell-ui through the keymap, toolbar, menus, input and display hooks, and per-cell `meta`.

## Plugins

```ts
import type { SpreadsheetPlugin } from 'cell-ui';

export const myPlugin: SpreadsheetPlugin = {
  name: 'my-plugin',
  install(sheet) {
    const off = [
      sheet.commands.register({ id: 'my.hello', run: ({ host }) => host.enterText('Hello') }),
      sheet.keymap.bind('Mod+Shift+H', 'my.hello'),
      sheet.toolbar.add({ id: 'my.hello', type: 'button', label: 'Hi', command: 'my.hello' }),
      sheet.contextMenu.add({ id: 'my.hello', label: 'Insert Hello', command: 'my.hello' }),
    ];
    return () => off.forEach((f) => f());   // Called on destroy and on removePlugin
  },
};

sheet.use(myPlugin);
sheet.removePlugin('my-plugin');
// Or at construction time: new Spreadsheet(el, { plugins: [myPlugin] })
```

The cleanup function returned by `install` runs on `sheet.destroy()` and `removePlugin()`. Each registration API returns a cleanup function, so calling them all together removes everything safely.

## Commands

Every user action is a command (`sheet.commands`). See [Keyboard Shortcuts](./keyboard-shortcuts.md) for the list of default commands.

```ts
sheet.commands.register({
  id: 'my.sum',
  label: 'AutoSum',
  run: ({ host, args, event }) => { … },     // Return false to mark the key press as "unhandled"
  isEnabled: ({ host }) => !host.isEditing,
});
sheet.commands.execute('my.sum', { args: 1 });   // Run programmatically
sheet.commands.get('nav.move');                  // Look up an existing command
sheet.commands.list();
```

Registering with the same `id` overrides a default command. For example, replacing `edit.commit` changes what happens on commit.

## Keymap

```ts
sheet.keymap.bind('Ctrl+Shift+K', 'my.cmd');                       // While operating the grid
sheet.keymap.bind('Escape', 'my.cancel', { when: 'edit' });        // Only while editing
sheet.keymap.bind('Mod+S', 'my.save', { when: 'always', args: {} });
sheet.keymap.unbind('Enter');                                      // Remove a default binding
sheet.keymap.unbindCommand('insert.date');
sheet.keymap.list();
```

- `when`: `'grid'` (default), `'edit'` (while editing a cell), `'always'`.
- Bindings registered later take precedence.
- `Mod` is Ctrl on Windows/Linux and ⌘ on macOS. For the notation, see [Keyboard Shortcuts](./keyboard-shortcuts.md#key-notation).
- `defaults: { keymap: false }` removes all default bindings; `installDefaultKeymap(sheet.keymap)` restores them whenever you like.

## Toolbar

```ts
sheet.toolbar.add({ id: 'sum', type: 'button', label: 'Σ', title: 'AutoSum', command: 'my.sum', order: 200,
                    isActive: (s) => …, isEnabled: (s) => … });
sheet.toolbar.add({ id: 'sep', type: 'separator', order: 199 });
sheet.toolbar.add({ id: 'unit', type: 'select', options: [{ value: 'px', label: 'px' }], getValue: (s) => …, onChange: (s, v) => … });
sheet.toolbar.add({ id: 'custom', type: 'custom', render: (s) => el, update: (s, el) => … });
sheet.toolbar.remove('strikethrough');
sheet.toolbar.refresh();   // Re-evaluate state (usually automatic)
```

Items with a smaller `order` appear further left (default items use 0–90). `label` may contain HTML (such as SVG icons). Buttons return focus to the grid after being clicked.

## Context menu

```ts
sheet.contextMenu.add({ id: 'my', label: 'My action', command: 'my.cmd', shortcut: 'Ctrl+Shift+K', order: 50,
                        isVisible: (s) => s.selection.mode === 'rows', isEnabled: (s) => … });
sheet.contextMenu.add({ id: 'sep', separator: true, order: 51 });
sheet.contextMenu.remove('pasteValues');
```

## Display and input hooks

| API | Role | Return value |
| --- | --- | --- |
| `addValueParser((text, address, sheet) => CellData \| CellValue \| undefined)` | Converts committed text (and pasted text) into cell data | `undefined` passes to the next parser (the last one is the Excel-like default parser) |
| `addDisplayResolver((cell, address, sheet) => string \| undefined)` | The string displayed in the cell (also used for the clipboard's `text/plain`) | `undefined` uses the default display |
| `addEditTextResolver((cell, address, sheet) => string \| undefined)` | The string placed in the editor when editing starts | `undefined` uses the default |
| `addCellRenderer((element, cell, address, sheet) => void)` | Decorates the cell element after rendering (adding classes, inserting icons, etc.) | – |

Hooks registered later are evaluated first.

## Per-cell `meta`

`CellData.meta` is an arbitrary object that the core does not interpret. It can hold the source text of a formula, comments, row IDs, and so on, and it follows copy and paste (within the same app), Undo, and `toJSON()`.

```ts
sheet.model.setMeta(0, 0, { formula: '=SUM(A1:A3)' });
sheet.model.setMeta(0, 0, { formula: undefined });   // Delete a key
sheet.model.getCell(0, 0)?.meta;
```

## Example: adding a formula engine

`examples/formula-plugin.ts` is a sample that implements things like `=SUM(A1:A3)` using only the hooks above ("Enable formula plugin" in the demo).

```ts
sheet.addValueParser((text) => (text.startsWith('=') ? { value: null, meta: { formula: text } } : undefined));
sheet.addDisplayResolver((cell, addr) => (typeof cell?.meta?.formula === 'string' ? String(evaluate(cell.meta.formula, addr)) : undefined));
sheet.addEditTextResolver((cell) => cell?.meta?.formula as string | undefined);
sheet.addCellRenderer((el, cell) => el.classList.toggle('formula-cell', !!cell?.meta?.formula));
sheet.model.events.on('change', () => sheet.grid.scheduleRender());   // Re-render when referenced cells change
```

## Extending validation

Add rule types with `sheet.registerValidator(type, fn)` (see [Validation](./validation.md#custom-rules)).

## Events

| Source | Event | Payload |
| --- | --- | --- |
| `sheet.model.events` | `change` | `{ cells, structural, sizes, validations, label, fromHistory }` |
| | `history` | `{ canUndo, canRedo }` |
| `sheet.selection.events` | `change` | `{ active, range, anchor, mode }` |
| `sheet.events` | `editstart` | `{ address, mode }` |
| | `editcommit` | `{ address, text, cell }` |
| | `editcancel` | `{ address }` |
| | `copy` | `{ range, cut }` |
| | `paste` | `{ range, block, internal }` |
| | `fill` | `{ source, target }` |
| | `validationerror` | `{ address, value, message, rule }` |
| | `destroy` | – |

`on()` returns an unsubscribe function. `once()` / `off()` are also available.

## Adding UI strings

```ts
import { registerLocale, getStrings } from 'cell-ui';
registerLocale('zh', { ...getStrings('en'), bold: '粗体', … });
new Spreadsheet(el, { locale: 'zh' });
```

## Low-level customization

- `sheet.grid` (`GridView`): rendering, scrolling, and coordinate calculations. `scheduleRender()`, `scrollIntoView()`, `cellRect()`, `autoFitWidth()`, `overlayLayer`.
- `sheet.clipboard` (`ClipboardState`): the most recently copied content and the cut state.
- `installDefaultCommands` / `installDefaultKeymap` / `installDefaultToolbar` / `installDefaultContextMenu`: re-register the default sets.
- `openColorPicker` / `openDropdown`: reuse the popover UI.
