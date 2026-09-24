# Styling (Formatting)

## `CellStyle`

Cell formatting is represented by a `CellStyle` object; any property left unspecified inherits the sheet default (`defaultStyle`).

| Property | Type | Description |
| --- | --- | --- |
| `fontFamily` | `string` | Font (same syntax as CSS `font-family`) |
| `fontSize` | `number` | Points (pt). Same unit as Excel |
| `bold` / `italic` / `underline` / `strikethrough` | `boolean` | Bold / italic / underline / strikethrough |
| `color` | `string` | Text color (CSS color) |
| `backgroundColor` | `string` | Fill |
| `hAlign` | `'left' \| 'center' \| 'right'` | Horizontal alignment. If unspecified, numbers align right, booleans center, and strings left |
| `vAlign` | `'top' \| 'middle' \| 'bottom'` | Vertical alignment (default: bottom) |
| `wrap` | `boolean` | Wrap text |
| `borderTop` / `borderRight` / `borderBottom` / `borderLeft` | `{ style, color }` | Borders. `style` is one of `thin` `medium` `thick` `dashed` `dotted` `double` `none` |
| `numberFormat` | `string` | Number format string. Not interpreted by the core, but preserved in round-trips with Excel (for plugins) |

```ts
sheet.model.setStyle(0, 0, { bold: true, color: '#c00000' });                 // Merge into a single cell
sheet.model.applyStyle(range, { backgroundColor: '#fff2cc', hAlign: 'center' }); // Apply to a range
sheet.applyStyle({ italic: true });                                            // Apply to the current selection
sheet.toggleStyle('bold');                                                     // Toggle based on the active cell's state
sheet.model.setStyle(0, 0, { bold: undefined });                               // Remove a property
sheet.model.clearRange(range, { styles: true });                               // Clear formatting
```

The `defaultStyle` option changes the default for the whole sheet.

```ts
new Spreadsheet(el, { defaultStyle: { fontFamily: 'Meiryo', fontSize: 10 } });
```

## Borders

Use `applyBorderPreset(sheet, range, preset)` or the `format.borders` command to apply the same presets as Excel's Borders menu.

| Preset | Result |
| --- | --- |
| `all` | All borders (grid) |
| `outside` | Outside border |
| `thickOutside` | Thick outside border |
| `inside` | Inside borders |
| `top` / `bottom` / `left` / `right` | A single side |
| `none` | No border (also removes edges shared with adjacent cells) |

```ts
import { applyBorderPreset } from 'cell-ui';
applyBorderPreset(sheet, sheet.selection.range, 'outside', '#000000');
sheet.commands.execute('format.borders', { args: 'all' });
```

On screen, borders are drawn on a layer separate from the cells, so they are not hidden by the fill of adjacent cells.

## Toolbar

The default toolbar contains the following items (from left to right).

| ID | Content |
| --- | --- |
| `undo` / `redo` | Undo / redo |
| `fontFamily` | Font (editable combo box, `FONT_FAMILIES`) |
| `fontSize` | Font size (`FONT_SIZES`) |
| `bold` / `italic` / `underline` / `strikethrough` | Text decoration |
| `borders` | Borders menu |
| `fontColor` / `fillColor` | Text color / fill (split buttons. ▾ opens a palette of Excel theme colors; "More colors" opens a color picker) |
| `alignTop` / `alignMiddle` / `alignBottom` | Vertical alignment |
| `alignLeft` / `alignCenter` / `alignRight` | Horizontal alignment |
| `wrap` | Wrap text |
| `clearFormats` | Clear formatting |

To add or remove items, see [Extensibility](./extensibility.md#toolbar). You can also remove default items, e.g. `sheet.toolbar.remove('strikethrough')`.

## Number display

Numbers are displayed in a form close to Excel's "General" format (up to 11 significant digits) and are right-aligned. If you want to interpret `numberFormat` to change how values are displayed, replace the display string with `addDisplayResolver` (see [Extensibility](./extensibility.md#display-and-input-hooks)).

## Theme

All classes are prefixed with `cui-`. Colors and the default font can be overridden with CSS variables on `.cui-root`.

```css
.cui-root {
  --cui-font: "Segoe UI", "Yu Gothic", sans-serif;
  --cui-accent: #1a73e8;                  /* Accent color for the selection outline and headers */
  --cui-accent-soft: rgba(26, 115, 232, 0.12);
  --cui-header-bg: #f3f3f3;
  --cui-header-fg: #444;
  --cui-header-selected-bg: #d3e3fd;
  --cui-header-full-bg: #1a73e8;
  --cui-gridline: #e1e1e1;
  --cui-border: #c6c6c6;
  --cui-toolbar-bg: #f8f8f8;
  --cui-cell-fg: #000;
  --cui-cell-bg: #fff;
}
```

For the Web Component (Shadow DOM), no `::part` is exposed, so either add an extra `<style>` to the shadow root after `injectStyles(shadowRoot)`, or prepare your own CSS based on `CELL_UI_CSS`.

Main classes:

| Class | Element |
| --- | --- |
| `.cui-root` | Root. Receives `.cui-root--focused` `.cui-root--editing` `.cui-root--fit-height` `.cui-root--fit-width` |
| `.cui-toolbar` `.cui-tb-btn` `.cui-tb-btn--active` | Toolbar |
| `.cui-formulabar` `.cui-namebox` `.cui-formula-input` | Formula bar |
| `.cui-grid` `.cui-viewport` `.cui-canvas` | Grid |
| `.cui-header` `.cui-header-col` `.cui-header-row` `.cui-header--selected` `.cui-header--full` | Headers |
| `.cui-cell` `.cui-cell-text` `.cui-cell--active` `.cui-cell--invalid` | Cells |
| `.cui-range` `.cui-active` `.cui-fill-handle` `.cui-cut-marquee` | Selection overlay |
| `.cui-editor` `.cui-editor--open` | In-cell editor |
| `.cui-menu` `.cui-popover` `.cui-dropdown` `.cui-validation-error` | Popovers |
| `.cui-statusbar` | Status bar |
