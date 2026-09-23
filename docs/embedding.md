# 埋め込みガイド

cell-ui は依存ライブラリを持たず、次の 3 つのファイルだけで動きます。

| ファイル | 用途 |
| --- | --- |
| `dist/cell-ui.js` | ES モジュール(bundler / `<script type="module">`) |
| `dist/cell-ui.iife.js` | 単一ファイル。読み込むとグローバル `CellUI` が定義される |
| `dist/cell-ui.css` | スタイルシート(Web Component 版は内蔵しているので不要) |

`embed.html` に以下すべてのサンプルがあります(`npm run dev` 後に `/embed.html`)。

## 1. `<script>` タグだけで使う

ビルド環境が無いシステムや、サーバーサイドテンプレートで描画している画面に向いています。

```html
<link rel="stylesheet" href="cell-ui.css">
<script src="cell-ui.iife.js"></script>

<div id="sheet" style="height: 500px"></div>
<script>
  const sheet = new CellUI.Spreadsheet(document.getElementById('sheet'), { locale: 'ja' });
  sheet.model.setValue(0, 0, 'Hello');
  sheet.model.events.on('change', () => save(sheet.toJSON()));
</script>
```

`CellUI` にはライブラリの公開 API がすべて含まれます(`CellUI.columnRange`, `CellUI.a1ToAddress` など)。

## 2. Web Component `<cell-ui-sheet>`

Shadow DOM で CSS を分離するため、ホストページのスタイルと干渉しません。どちらのビルドを読み込んでも自動的に登録されます(タグ名を変えたい場合は `defineCellUiElement('my-sheet')`)。

```html
<cell-ui-sheet id="s" rows="200" cols="30" locale="ja" style="height: 500px"></cell-ui-sheet>
<script>
  const el = document.getElementById('s');
  el.whenReady.then((sheet) => sheet.model.setValue(0, 0, 'Hello'));
  el.addEventListener('change', (e) => console.log(e.detail.cells));
  el.data = savedSnapshot;          // 復元。el.data で取得
</script>
```

- 属性の一覧は [オプション一覧](./options.md) を参照してください。属性を書き換えると即座に反映されます。
- 要素は HTML のパース時点で初期化されるため、後続の `<script>` で `ready` イベントを待つと取りこぼします。`whenReady` か `el.sheet` を使ってください。
- 属性で表せない設定(プラグイン、`defaults`、`data`)は、接続前に `el.options = { ... }` を設定するか、`document.createElement('cell-ui-sheet')` で生成してから `options` を設定して `appendChild` します。
- 要素を DOM から外すと内部の `Spreadsheet` は破棄され、再接続時に内容が復元されます。
- 右クリックメニューやカラーピッカーは Shadow Root 内に追加されるので、そのまま動作します。

## 3. npm パッケージとして bundler から使う

### React

```tsx
import { useEffect, useRef } from 'react';
import { Spreadsheet, type SheetSnapshot } from 'cell-ui';
import 'cell-ui/style.css';

export function Sheet({ value, onChange }: { value?: Partial<SheetSnapshot>; onChange: (json: SheetSnapshot) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sheet = new Spreadsheet(ref.current!, { locale: 'ja', data: value });
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
  sheet = new Spreadsheet(el.value!, { locale: 'ja' });
});
onBeforeUnmount(() => sheet.destroy());
</script>
```

Angular / Svelte なども同様に「マウント時に生成、アンマウント時に `destroy()`」で使えます。

## 4. iframe

別ドメインや完全に独立させたい場合は、`index.html` のようなページを iframe で表示し、`postMessage` で `sheet.toJSON()` / `sheet.load()` をやり取りしてください。クリップボード操作は iframe 内でもそのまま動きます。

## 埋め込み時の注意点

- **高さ**: コンテナ(または `<cell-ui-sheet>`)に高さを与えてください。行数から高さを決める場合は `fitContent` を使います。
- **破棄**: SPA で画面遷移する場合は必ず `sheet.destroy()` を呼んでください。DOM、イベント、`window` のリスナをすべて解放します。
- **フォーカス**: 内部のキー入力はグリッド内の非表示 `textarea` が受け取ります。プログラムから操作したあとにキーボード入力を続けたい場合は `sheet.focus()` を呼びます。
- **ポップオーバー**: メニューやカラーピッカーは `sheet.popoverHost`(通常 `document.body`、Shadow DOM 内なら Shadow Root)に `position: fixed` で追加されます。祖先要素に `transform` があると位置がずれることがあります。
- **CSS**: すべてのクラスは `cui-` プレフィックス付きで、色は `.cui-root` の CSS 変数で上書きできます([スタイル](./styling.md#テーマ))。
- **保存**: 内部状態は `sheet.toJSON()` で取得し、`sheet.load()` / `data` オプションで復元します([データ形式](./data-format.md))。
- **クリップボード権限**: キーボード操作(Ctrl+C/V)はブラウザ標準のクリップボードイベントを使うため権限不要です。メニューやボタンからのコピー / 貼り付けは非同期 Clipboard API を使うため、HTTPS(または localhost)と、ブラウザによっては許可ダイアログが必要です。
