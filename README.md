# cell-ui

Web ブラウザで動く、Excel ライクなセル UI ライブラリです。フレームワーク非依存(TypeScript / DOM のみ)で、関数(数式)機能は持ちませんが、プラグインで拡張できる設計になっています。

- **Microsoft Excel との相互コピー&ペースト** — 値だけでなく、太字・斜体・色・塗りつぶし・配置・罫線・フォントなどの書式も往復します(`text/html` + `text/plain` の Excel 互換フォーマット)。
- **Excel と同じショートカットキー** — 矢印 / Ctrl+矢印 / Shift+矢印 / Tab / Enter / F2 / Delete / Ctrl+C,X,V / Ctrl+Z,Y / Ctrl+B,I,U / Ctrl+D,R / Ctrl+Space / Shift+Space / Ctrl+A / Ctrl+1 / Ctrl+9,0 / Alt+Enter … 。
- **スタイル選択ツールバー** — フォント、サイズ、太字・斜体・下線・取り消し線、文字色、塗りつぶし、上下左右の配置、折り返し、罫線プリセット、書式クリア。
- **セル UI に特化** — 仮想スクロール、列幅・行高のドラッグ変更とダブルクリック自動調整、フィルハンドル(連続データ)、行・列の挿入/削除/非表示、右クリックメニュー、名前ボックス+数式バー、ステータスバー(平均/個数/合計)、Undo/Redo。
- **拡張可能** — コマンドレジストリ、キーマップ、ツールバー、コンテキストメニュー、値パーサ、表示リゾルバ、セルレンダラ、セルごとの `meta` によって、数式エンジンや入力規則などを後から載せられます(`examples/formula-plugin.ts` に =SUM 等のサンプル)。

## ドキュメント

詳細は [docs/](./docs/README.md) を参照してください。

| ドキュメント | 内容 |
| --- | --- |
| [はじめに](./docs/getting-started.md) | インストール、最小構成、開発コマンド |
| [オプション一覧](./docs/options.md) | コンストラクタ / Web Component 属性 |
| [埋め込みガイド](./docs/embedding.md) | `<script>` タグ、Web Component、React / Vue、iframe |
| [レイアウトと UI 部品](./docs/layout.md) | 固定サイズ表、行・列の追加、ヘッダー / バーの表示切り替え、列名 |
| [ショートカットキー](./docs/keyboard-shortcuts.md) | Excel 互換のキー一覧 |
| [クリップボード](./docs/clipboard.md) | Excel との相互コピペ |
| [スタイル](./docs/styling.md) | 書式、罫線、ツールバー、テーマ |
| [入力規則](./docs/validation.md) | 数値のみ / リスト選択 |
| [拡張](./docs/extensibility.md) | プラグイン API |
| [API リファレンス](./docs/api.md) | クラスとメソッド |
| [データ形式](./docs/data-format.md) | スナップショット JSON |
| [アーキテクチャ](./docs/architecture.md) | 内部設計 |
| [開発ガイド](./docs/development.md) | ビルド、テスト、CI |

## 使い方

```bash
npm install
npm run dev      # デモ (http://localhost:5173) / 埋め込みサンプル (/embed.html)
npm test         # ユニットテスト
npm run e2e      # Chromium での動作確認
npm run build    # dist/ にビルド
```

```ts
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';

const sheet = new Spreadsheet(document.getElementById('app')!, { rows: 1000, cols: 52, locale: 'ja' });
sheet.model.setValue(0, 0, 'Hello');
sheet.model.setCell(0, 1, { value: 42, style: { bold: true, color: '#c00000' } });
const snapshot = sheet.toJSON();
```

```html
<!-- ビルド不要の埋め込み(Web Component) -->
<link rel="stylesheet" href="cell-ui.css"><script src="cell-ui.iife.js"></script>
<cell-ui-sheet rows="10" cols="5" fit-content column-labels="品名,数量,単価,備考"></cell-ui-sheet>
```

## 構成

```
src/
  model/       型・A1 アドレス・スパースなシートモデル(トランザクション / Undo / Redo)・入力規則
  clipboard/   Excel 互換 TSV / HTML のシリアライズとパース
  keyboard/    キーコンボの解釈とキーマップ
  render/      仮想スクロール描画
  ui/          ツールバー・カラーピッカー・コンテキストメニュー・数式バー・ステータスバー・ドロップダウン
  defaults/    既定のコマンド・キー割り当て・ツールバー・メニュー
  plugins/     拡張 API の型定義
  spreadsheet.ts  すべてを束ねるコンポーネント
  element.ts   Web Component <cell-ui-sheet>
examples/      デモと数式プラグインのサンプル
docs/          ドキュメント
test/          vitest ユニットテスト
scripts/e2e.mjs  Chromium での動作確認
```

---

## English

Excel-like spreadsheet UI for the browser. Framework-free TypeScript. No formula engine in the core, but everything (commands, key bindings, toolbar, context menu, value parsing, display, rendering, per-cell `meta`, validation rules) is pluggable. See [docs/](./docs/README.md) (Japanese).

- Copy & paste to/from Microsoft Excel with formatting (Excel-compatible `text/html` + TSV `text/plain`).
- Excel keyboard shortcuts (navigation, editing, clipboard, formatting, fill, structure).
- Styling toolbar: font, size, bold/italic/underline/strikethrough, text & fill colour, alignment, wrap, borders.
- Data validation: number-only and list-selection rules with an in-cell dropdown.
- Virtualised grid, resizable rows/columns, fill handle, row/column insert/delete/hide/append, fixed-size tables (`fitContent`, `autoExpand`, custom column labels), hideable headers/bars, context menu, name box + formula bar, status bar, undo/redo.
- Embeddable three ways: ES module for bundlers, a single-file IIFE build for `<script>` tags (global `CellUI`), and a `<cell-ui-sheet>` custom element with Shadow-DOM-isolated styles. See `embed.html`.

```ts
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';
const sheet = new Spreadsheet(document.getElementById('app')!, { locale: 'en' });
```
