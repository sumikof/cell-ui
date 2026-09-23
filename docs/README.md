# cell-ui ドキュメント

Web ブラウザで動く Excel ライクなセル UI ライブラリ **cell-ui** のドキュメントです。フレームワーク非依存の TypeScript で書かれ、Excel との書式付きコピー&ペースト、Excel と同じショートカット、スタイル編集、入力規則を備え、関数などの機能はプラグインで後付けできる設計になっています。

## 目次

| ドキュメント | 内容 |
| --- | --- |
| [はじめに](./getting-started.md) | インストール、最小構成、開発コマンド |
| [オプション一覧](./options.md) | コンストラクタ / Web Component 属性のリファレンス |
| [埋め込みガイド](./embedding.md) | `<script>` タグ、Web Component、React / Vue、iframe、SPA での注意点 |
| [レイアウトと UI 部品](./layout.md) | 行数・列数、固定サイズ表(`fitContent`)、行・列の追加、ヘッダー / バーの表示切り替え、列名の差し替え |
| [ショートカットキー](./keyboard-shortcuts.md) | Excel 互換のキー一覧と編集モードの挙動 |
| [クリップボード(Excel 連携)](./clipboard.md) | Excel との相互コピペの仕組み、対応する書式、貼り付けの規則 |
| [スタイル(書式)](./styling.md) | `CellStyle` の項目、ツールバー、罫線、テーマ CSS 変数 |
| [入力規則](./validation.md) | 数値のみ / リスト選択、範囲の指定、独自ルール |
| [拡張(プラグイン API)](./extensibility.md) | コマンド、キーマップ、ツールバー、メニュー、値パーサ、表示リゾルバ、セルレンダラ、`meta` |
| [API リファレンス](./api.md) | `Spreadsheet` / `SheetModel` / `Selection` / `CellUiElement` のメソッドとイベント |
| [データ形式](./data-format.md) | `toJSON()` / `load()` のスナップショット形式、セルとアドレスの型 |
| [アーキテクチャ](./architecture.md) | ディレクトリ構成、描画・編集・クリップボードの内部設計 |
| [開発ガイド](./development.md) | ビルド、テスト、ブラウザ検証、CI |

## クイックスタート

```bash
npm install
npm run dev        # デモ http://localhost:5173 (index.html) / 埋め込みサンプル /embed.html
npm run build      # dist/ にビルド
```

```ts
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';

const sheet = new Spreadsheet(document.getElementById('app')!, { rows: 100, cols: 20, locale: 'ja' });
sheet.model.setValue(0, 0, 'Hello');
```

```html
<!-- ビルド不要の埋め込み -->
<link rel="stylesheet" href="cell-ui.css"><script src="cell-ui.iife.js"></script>
<cell-ui-sheet rows="10" cols="5" fit-content column-labels="品名,数量,単価,備考"></cell-ui-sheet>
```
