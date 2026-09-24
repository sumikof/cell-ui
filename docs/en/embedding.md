# Embedding guide

cell-ui has no library dependencies and runs with just the following three files.

| File | Purpose |
| --- | --- |
| `dist/cell-ui.js` | ES module (bundler / `<script type="module">`) |
| `dist/cell-ui.iife.js` | Single file. Loading it defines the global `CellUI` |
| `dist/cell-ui.css` | Stylesheet (not needed for the Web Component version, which bundles it) |

`embed.html` contains samples of everything below (`/embed.html` after `npm run dev`).

## 1. Using only a `<script>` tag

Suited to systems without a build environment, or to pages rendered with server-side templates.

```html
<link rel="stylesheet" href="cell-ui.css">
<script src="cell-ui.iife.js"></script>

<div id="sheet" style="height: 500px"></div>
<script>
  const sheet = new CellUI.Spreadsheet(document.getElementById('sheet'), { locale: 'en' });
  sheet.model.setValue(0, 0, 'Hello');
  sheet.model.events.on('change', () => save(sheet.toJSON()));
</script>
```

`CellUI` contains the library's entire public API (`CellUI.columnRange`, `CellUI.a1ToAddress`, and so on).

## 2. Web Component `<cell-ui-sheet>`

CSS is isolated with Shadow DOM, so it does not interfere with the host page's styles. It is registered automatically whichever build you load (to change the tag name, use `defineCellUiElement('my-sheet')`).

```html
<cell-ui-sheet id="s" rows="200" cols="30" locale="en" style="height: 500px"></cell-ui-sheet>
<script>
  const el = document.getElementById('s');
  el.whenReady.then((sheet) => sheet.model.setValue(0, 0, 'Hello'));
  el.addEventListener('change', (e) => console.log(e.detail.cells));
  el.data = savedSnapshot;          // Restore. Read it back with el.data
</script>
```

- See [Options](./options.md) for the list of attributes. Changing an attribute takes effect immediately.
- The element is initialized when the HTML is parsed, so waiting for the `ready` event in a later `<script>` will miss it. Use `whenReady` or `el.sheet` instead.
- For settings that cannot be expressed as attributes (plugins, `defaults`, `data`), either set `el.options = { ... }` before connection, or create the element with `document.createElement('cell-ui-sheet')`, set `options`, and then `appendChild` it.
- When the element is removed from the DOM, the internal `Spreadsheet` is destroyed, and its contents are restored when it is reconnected.
- The right-click menu and color picker are added inside the Shadow Root, so they work as is.

## 3. Using it as an npm package from a bundler

### React

```tsx
import { useEffect, useRef } from 'react';
import { Spreadsheet, type SheetSnapshot } from 'cell-ui';
import 'cell-ui/style.css';

export function Sheet({ value, onChange }: { value?: Partial<SheetSnapshot>; onChange: (json: SheetSnapshot) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sheet = new Spreadsheet(ref.current!, { locale: 'en', data: value });
    const off = sheet.model.events.on('change', () => onChange(sheet.toJSON()));
    return () => {
      off();
      sheet.destroy();
    };
  }, []);
  return <div ref={ref} style={{ height: 500 }} />;
}
```

### Vue

```vue
<template><div ref="el" style="height: 500px" /></template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';

const el = ref<HTMLDivElement>();
let sheet: Spreadsheet;
onMounted(() => {
  sheet = new Spreadsheet(el.value!, { locale: 'en' });
});
onBeforeUnmount(() => sheet.destroy());
</script>
```

Angular / Svelte and others work the same way: create it on mount and call `destroy()` on unmount.

## 4. iframe

If you need a different domain or complete isolation, display a page like `index.html` in an iframe and exchange `sheet.toJSON()` / `sheet.load()` via `postMessage`. Clipboard operations work as is inside the iframe.

## Notes on embedding

- **Height**: Give the container (or `<cell-ui-sheet>`) a height. To determine the height from the number of rows, use `fitContent`.
- **Destruction**: When navigating between screens in an SPA, always call `sheet.destroy()`. It releases all DOM, events, and `window` listeners.
- **Focus**: Keyboard input is received internally by a hidden `textarea` inside the grid. If you want keyboard input to continue after operating on the sheet programmatically, call `sheet.focus()`.
- **Popovers**: Menus and the color picker are added with `position: fixed` to `sheet.popoverHost` (normally `document.body`, or the Shadow Root when inside Shadow DOM). If an ancestor element has a `transform`, their position may be off.
- **CSS**: All classes have the `cui-` prefix, and colors can be overridden with CSS variables on `.cui-root` ([Styles](./styling.md#theme)).
- **Saving**: Get the internal state with `sheet.toJSON()` and restore it with `sheet.load()` / the `data` option ([Data format](./data-format.md)).
- **Clipboard permissions**: Keyboard operations (Ctrl+C/V) use the browser's standard clipboard events, so no permission is needed. Copy / paste from menus or buttons uses the asynchronous Clipboard API, which requires HTTPS (or localhost) and, depending on the browser, a permission dialog.
