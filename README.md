# cell-ui

Web ブラウザで動く、Excel ライクなセル UI ライブラリです。フレームワーク非依存(TypeScript / DOM のみ)で、関数(数式)機能は持ちませんが、プラグインで拡張できる設計になっています。

- **Microsoft Excel との相互コピー&ペースト** — 値だけでなく、太字・斜体・色・塗りつぶし・配置・罫線・フォントなどの書式も往復します(`text/html` + `text/plain` の Excel 互換フォーマット)。
- **Excel と同じショートカットキー** — 矢印 / Ctrl+矢印 / Shift+矢印 / Tab / Enter / F2 / Delete / Ctrl+C,X,V / Ctrl+Z,Y / Ctrl+B,I,U / Ctrl+D,R / Ctrl+Space / Shift+Space / Ctrl+A / Ctrl+1 / Ctrl+9,0 / Alt+Enter … 。
- **スタイル選択ツールバー** — フォント、サイズ、太字・斜体・下線・取り消し線、文字色、塗りつぶし、上下左右の配置、折り返し、罫線プリセット、書式クリア。
- **セル UI に特化** — 仮想スクロール、列幅・行高のドラッグ変更とダブルクリック自動調整、フィルハンドル(連続データ)、行・列の挿入/削除/非表示、右クリックメニュー、名前ボックス+数式バー、ステータスバー(平均/個数/合計)、Undo/Redo。
- **拡張可能** — コマンドレジストリ、キーマップ、ツールバー、コンテキストメニュー、値パーサ、表示リゾルバ、セルレンダラ、セルごとの `meta` によって、数式エンジンや入力規則などを後から載せられます(`examples/formula-plugin.ts` に =SUM 等のサンプル)。

## 使い方

```bash
npm install
npm run dev      # デモ (http://localhost:5173)
npm test         # ユニットテスト (vitest + jsdom)
npm run e2e      # Chromium での動作確認 (playwright)
npm run build    # dist/ にライブラリをビルド
```

```ts
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';

const sheet = new Spreadsheet(document.getElementById('app')!, {
  rows: 1000,
  cols: 52,
  locale: 'ja',          // 'en' も可 / 省略時はブラウザ言語
});

sheet.model.setValue(0, 0, 'Hello');
sheet.model.setCell(0, 1, { value: 42, style: { bold: true, color: '#c00000' } });
sheet.model.events.on('change', (e) => console.log(e.cells));

const snapshot = sheet.toJSON(); // 保存
sheet.load(snapshot);            // 復元
```

コンテナは高さを持つ要素にしてください(`.cui-root` は `height: 100%` で親を埋めます)。`fitContent: true` を指定した場合は逆に、行数・列数からコンポーネントの大きさが決まるので親の高さは不要です。

### UI 部品の表示/非表示

```ts
// 素の表だけを表示する
const sheet = new Spreadsheet(container, { headers: false, toolbar: false, formulaBar: false, statusBar: false, contextMenu: false });

// 後から切り替える
sheet.setVisible('toolbar', true);
sheet.setVisible('rowHeaders', false);   // 'toolbar' | 'formulaBar' | 'nameBox' | 'formulaInput' | 'statusBar' | 'contextMenu' | 'headers' | 'rowHeaders' | 'columnHeaders' | 'gridlines' | 'fillHandle'
sheet.setVisible('formulaInput', false); // 関数入力欄だけ消して名前ボックスは残す
sheet.isVisible('headers');
```

### 列名の差し替え(固定幅の表)

```ts
const sheet = new Spreadsheet(container, { rows: 10, cols: 4, fitContent: true, columnLabels: ['品名', '数量', '単価', '備考'] });
sheet.setColumnLabels(['Item', 'Qty', 'Price']);   // 後から変更。足りない列は D, E… のまま
```

Web Component では `column-labels="品名,数量,単価,備考"`(または JSON 配列)で指定します。スクロールする通常のシート(`fitContent` 無し)では列が動的に増減するため無視され、コンソールに警告を出します。

Web Component では `headers="false"` `row-headers="false"` `column-headers="false"` `toolbar="false"` `formula-bar="false"` `name-box="false"` `formula-input="false"` `status-bar="false"` `context-menu="false"` `gridlines="false"` `fill-handle="false"` の属性で指定でき、属性を書き換えると即座に反映されます。ヘッダーを消しても選択・入力・コピー&ペーストはそのまま使え、行・列のサイズ変更や全行/全列の選択は API(`setColumnWidth` / `selection.selectRows` など)から行えます。ツールバーの中身だけを差し替えたい場合は `defaults: { toolbar: false }` で既定のボタンを外し、`sheet.toolbar.add()` で独自のボタンを登録してください。

### 小さな固定サイズの表(例: 10 行 × 5 列)と行・列の追加

```ts
const sheet = new Spreadsheet(container, { rows: 10, cols: 5, fitContent: true, autoExpand: true });
sheet.appendRows(1);        // 末尾に 1 行追加(sheet.model.appendRows でも可)
sheet.appendColumns(2);     // 末尾に 2 列追加
sheet.model.insertRows(3, 1);   // 4 行目の位置に挿入
sheet.model.deleteColumns(0, 1);
sheet.model.resize(20, 8);      // 行数・列数を直接変更(はみ出したセルは削除)
```

右クリックメニューの「行の挿入 / 列の挿入 / 末尾に行を追加 / 末尾に列を追加 / 行の削除 / 列の削除」、ショートカット Ctrl++ / Ctrl+- でも操作できます。Excel からより大きな範囲を貼り付けた場合も、必要な分だけ自動的に広がります。Web Component では `<cell-ui-sheet rows="10" cols="5" fit-content auto-expand>` と `el.appendRows(n)` / `el.appendColumns(n)` が対応します。

### オプション

| オプション | 既定 | 説明 |
| --- | --- | --- |
| `rows` / `cols` | 1000 / 52 | 初期サイズ(貼り付け時などに自動で拡張) |
| `defaultColumnWidth` / `defaultRowHeight` | 80 / 22 | px |
| `defaultStyle` | Calibri 11pt | シート既定の書式 |
| `toolbar` / `formulaBar` / `statusBar` / `contextMenu` | true | ツールバー・数式バー・ステータスバー・右クリックメニューの表示。`formulaBar: { nameBox: true, input: false }` で名前ボックスだけ残して関数入力欄を消すこともできる |
| `columnLabels` | – | 列名ヘッダーを `['品名', '数量', …]` や `(col) => string` で差し替える。**固定幅(`fitContent: true` / `'width'`)の表のみ**有効で、ラベルの無い列は A, B, C… に戻る。セル参照(名前ボックス・クリップボード)は英字のまま |
| `headers` | true | 行番号・列名ヘッダー。`false` で両方非表示、`{ rows: false }` / `{ cols: false }` で片方だけ非表示 |
| `rowHeaderWidth` / `columnHeaderHeight` | 46 / 22 | ヘッダーのサイズ(px) |
| `showGridlines` / `fillHandle` | true | 枠線とフィルハンドル |
| `locale` | ブラウザ言語 | `'ja'` / `'en'`(`registerLocale` で追加可能) |
| `fitContent` | false | `true` / `'height'` / `'width'`: 行数・列数に合わせてコンポーネント自体のサイズを決める(10行5列のような小さな固定表向け。行・列を追加すると自動で広がる) |
| `autoExpand` | false | `true` または `{ rows, cols }`: 最終行で Enter/↓、最終列で Tab/→ を押すと自動で行・列を追加 |
| `data` | – | 初期スナップショット |
| `plugins` | – | `SpreadsheetPlugin[]` |
| `defaults.keymap / toolbar / contextMenu` | true | 既定のキー割り当て・ツールバー・メニューを無効化して独自定義する |

## 他の Web システムへの埋め込み

依存ライブラリはなく、ビルド成果物は `dist/cell-ui.js`(ES モジュール)、`dist/cell-ui.iife.js`(`<script>` 用の単一ファイル、グローバル `CellUI`)、`dist/cell-ui.css` の 3 つです。用途に応じて次のいずれかを選べます(`embed.html` にサンプルがあります)。

### 1. `<script>` タグだけで使う(ビルド環境が無いシステム、レガシーな画面など)

```html
<link rel="stylesheet" href="cell-ui.css">
<script src="cell-ui.iife.js"></script>
<div id="sheet" style="height:500px"></div>
<script>
  const sheet = new CellUI.Spreadsheet(document.getElementById('sheet'), { locale: 'ja' });
  sheet.model.setValue(0, 0, 'Hello');
  sheet.model.events.on('change', () => save(sheet.toJSON()));
</script>
```

### 2. Web Component `<cell-ui-sheet>`(CSS を Shadow DOM で分離)

ホスト側の CSS と干渉しないので、既存ページのスタイルが複雑な場合に向いています。どちらのビルドを読み込んでも自動登録されます。

```html
<cell-ui-sheet rows="200" cols="30" locale="ja" style="height:500px"></cell-ui-sheet>
<script>
  const el = document.querySelector('cell-ui-sheet');
  el.whenReady.then((sheet) => sheet.model.setValue(0, 0, 'Hello'));
  el.addEventListener('change', (e) => console.log(e.detail.cells));   // change / selectionchange / editcommit / paste / copy
  el.data = savedSnapshot;   // JSON の読み込み。el.data で取り出し
</script>
```

属性: `rows` `cols` `locale` `toolbar` `formula-bar` `status-bar` `context-menu` `gridlines` `fill-handle`(`"false"` で無効)。プロパティ: `sheet` `data` `options`(接続前に設定するとコンストラクタオプションに合成)。

### 3. npm パッケージとして bundler から使う(React / Vue / Angular / Svelte など)

```tsx
// React
import { useEffect, useRef } from 'react';
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';

export function Sheet({ onChange }: { onChange: (json: unknown) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sheet = new Spreadsheet(ref.current!, { locale: 'ja' });
    const off = sheet.model.events.on('change', () => onChange(sheet.toJSON()));
    return () => { off(); sheet.destroy(); };
  }, []);
  return <div ref={ref} style={{ height: 500 }} />;
}
```

```vue
<!-- Vue -->
<template><div ref="el" style="height: 500px" /></template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';
const el = ref<HTMLDivElement>();
let sheet: Spreadsheet;
onMounted(() => { sheet = new Spreadsheet(el.value!, { locale: 'ja' }); });
onBeforeUnmount(() => sheet.destroy());
</script>
```

### 4. iframe

別ドメインや完全に独立させたい場合は、`index.html` のようなページを iframe で表示し、`postMessage` で `sheet.toJSON()` / `sheet.load()` をやり取りしてください。クリップボード操作は iframe 内でもそのまま動きます。

### 埋め込み時の注意

- コンテナ(または `<cell-ui-sheet>`)に高さを与えてください。`.cui-root` は親要素を 100% で埋めます。
- `sheet.destroy()` を呼ぶと DOM・イベント・`window` リスナをすべて解放します(SPA で画面遷移する場合に必須)。
- コンテキストメニューやカラーピッカーは `sheet.popoverHost`(通常 `document.body`、Shadow DOM 内なら shadow root)に追加されます。
- すべての CSS クラスは `cui-` プレフィックス付きで、色などは `.cui-root` の CSS 変数(`--cui-accent` など)で上書きできます。
- 内部状態は `sheet.toJSON()` で取得でき、サーバー保存後に `sheet.load()` / `data` オプションで復元できます。

## ショートカット一覧

| キー | 動作 |
| --- | --- |
| 矢印 / Shift+矢印 | 移動 / 範囲拡張 |
| Ctrl+矢印 / Ctrl+Shift+矢印 | データ端へジャンプ / 端まで選択 |
| Tab / Shift+Tab, Enter / Shift+Enter | 右 / 左, 下 / 上(Tab で移動後の Enter は開始列に戻る。複数選択中は選択範囲内を巡回) |
| Home / Ctrl+Home / Ctrl+End / End | 行頭 / A1 / 最終セル / 行の最終データ |
| PageUp / PageDown / Alt+PageUp / Alt+PageDown | 1 画面移動 |
| F2 / Esc / Alt+Enter / Ctrl+Enter | 編集 / 取消 / セル内改行 / 選択範囲すべてに入力 |
| 文字キー | そのまま入力開始(Enter モード:矢印で確定して移動) |
| Delete / Backspace | 内容クリア / クリアして編集 |
| Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+Shift+V | コピー / 切り取り / 貼り付け / 値のみ貼り付け |
| Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) | 元に戻す / やり直し |
| Ctrl+B / Ctrl+I / Ctrl+U / Ctrl+5 | 太字 / 斜体 / 下線 / 取り消し線 |
| Ctrl+Shift+& / Ctrl+Shift+_ | 外枠罫線 / 罫線削除 |
| Ctrl+Shift+> / Ctrl+Shift+< | フォントサイズ拡大 / 縮小 |
| Ctrl+1 | 書式設定(ツールバーへフォーカス) |
| Ctrl+A / Ctrl+Shift+* | 現在の領域 → 全選択 / 現在の領域 |
| Shift+Space / Ctrl+Space | 行選択 / 列選択 |
| Ctrl+D / Ctrl+R | 下方向 / 右方向にコピー |
| Ctrl++ / Ctrl+- | 行(列)の挿入 / 削除 |
| Ctrl+9 / Ctrl+Shift+9 / Ctrl+0 / Ctrl+Shift+0 | 行非表示 / 再表示 / 列非表示 / 再表示 |
| Ctrl+; / Ctrl+: | 今日の日付 / 現在時刻 |

macOS では Ctrl の代わりに ⌘ を使います(`Mod` 修飾子)。

## Excel との貼り付け互換

- **cell-ui → Excel**: コピー時に `text/plain`(TSV。改行・タブ・引用符を含むセルは Excel 流にクォート)と `text/html`(`<table>` + インラインスタイル、`x:num` / `mso-number-format`)を書き込みます。Excel はこれを読んで書式ごと貼り付けます。
- **Excel → cell-ui**: Excel が生成する HTML(`<style>` 内の `.xl65 {…}` クラス、`td` 既定値、インライン `style`、`<b>/<i>/<font>` 等)を解釈して、値・数値(`x:num`)・書式・罫線・折り返し・数値書式文字列を復元します。HTML が無い場合は TSV をパースします。
- 貼り付け先が 1 セルならブロックの大きさで、選択範囲がブロックの整数倍ならタイル状に貼り付けます(Excel と同じ)。
- 同一アプリ内の貼り付けは内部ペイロードを使うため、プラグインが `meta` に保存したデータ(数式ソースなど)もそのまま移動します。

## 拡張(プラグイン)

```ts
import type { SpreadsheetPlugin } from 'cell-ui';

export const myPlugin: SpreadsheetPlugin = {
  name: 'my-plugin',
  install(sheet) {
    const off = [
      // 入力テキストをセルデータに変換(undefined を返すと次のパーサへ)
      sheet.addValueParser((text) => (text.startsWith('=') ? { value: null, meta: { formula: text } } : undefined)),
      // 表示文字列(undefined で既定の表示)
      sheet.addDisplayResolver((cell) => (cell?.meta?.formula ? evaluate(cell.meta.formula) : undefined)),
      // 編集時に表示する文字列
      sheet.addEditTextResolver((cell) => cell?.meta?.formula as string | undefined),
      // 描画後のセル要素を装飾
      sheet.addCellRenderer((el, cell) => el.classList.toggle('is-formula', !!cell?.meta?.formula)),
      // コマンド + ショートカット + ツールバー + 右クリックメニュー
      sheet.commands.register({ id: 'my.sum', run: ({ host }) => host.startEdit('enter', '=SUM(') }),
      sheet.keymap.bind('Alt+=', 'my.sum'),
      sheet.toolbar.add({ id: 'my.sum', type: 'button', label: 'Σ', command: 'my.sum' }),
      sheet.contextMenu.add({ id: 'my.sum', label: 'AutoSum', command: 'my.sum' }),
    ];
    return () => off.forEach((f) => f());
  },
};

sheet.use(myPlugin);
```

主な拡張ポイント:

| API | 用途 |
| --- | --- |
| `sheet.commands` | すべての操作はコマンド(`nav.move`, `edit.commit`, `format.toggle`, `clipboard.paste` …)。上書き・追加・プログラムからの実行が可能 |
| `sheet.keymap` | `bind('Ctrl+Shift+K', 'cmd', { when: 'grid' \| 'edit' \| 'always', args })` / `unbind` / `unbindCommand` |
| `sheet.toolbar` | `button` / `select` / `separator` / `custom` アイテム |
| `sheet.contextMenu` | ラベル・ショートカット表示・表示条件付きのメニュー項目 |
| `addValueParser` / `addDisplayResolver` / `addEditTextResolver` / `addCellRenderer` | 入力・表示・編集・描画のフック |
| `CellData.meta` | セルごとの任意データ(コピー/貼り付け・Undo・JSON に追従) |
| `CellStyle.numberFormat` | 数値書式(コアは解釈しないが Excel との往復で保持) |
| `sheet.model.events` / `sheet.selection.events` / `sheet.events` | `change`, `history`, `editcommit`, `paste`, `fill` などのイベント |
| `registerLocale(code, strings)` | UI 文言の追加 |

デモ(`npm run dev`)の「数式プラグインを有効化」で `examples/formula-plugin.ts`(=SUM/AVERAGE/MIN/MAX/COUNT と四則演算)を試せます。

## 構成

```
src/
  model/       型・A1 アドレス・スパースなシートモデル(トランザクション / Undo / Redo)
  clipboard/   Excel 互換 TSV / HTML のシリアライズとパース、貼り付け範囲の計算
  keyboard/    キーコンボの解釈とキーマップ
  render/      仮想スクロール描画(セル・ヘッダ・罫線・選択・エディタ)
  ui/          ツールバー・カラーピッカー・コンテキストメニュー・数式バー・ステータスバー
  defaults/    既定のコマンド・キー割り当て・ツールバー・メニュー
  plugins/     拡張 API の型定義
  spreadsheet.ts  すべてを束ねるコンポーネント
examples/      デモと数式プラグインのサンプル
test/          vitest ユニットテスト
scripts/e2e.mjs  Chromium での動作確認
```

---

## English

Excel-like spreadsheet UI for the browser. Framework-free TypeScript. No formula engine in the core, but everything (commands, key bindings, toolbar, context menu, value parsing, display, rendering, per-cell `meta`) is pluggable — see `examples/formula-plugin.ts`.

- Copy & paste to/from Microsoft Excel with formatting (Excel-compatible `text/html` + TSV `text/plain`).
- Excel keyboard shortcuts (navigation, editing, clipboard, formatting, fill, structure).
- Styling toolbar: font, size, bold/italic/underline/strikethrough, text & fill colour, alignment, wrap, borders.
- Virtualised grid, resizable rows/columns, fill handle, row/column insert/delete/hide, context menu, name box + formula bar, status bar, undo/redo.
- Embeddable three ways: ES module for bundlers, a single-file IIFE build for `<script>` tags (global `CellUI`), and a `<cell-ui-sheet>` custom element with Shadow-DOM-isolated styles. See `embed.html`.

```ts
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';
const sheet = new Spreadsheet(document.getElementById('app')!, { locale: 'en' });
```
