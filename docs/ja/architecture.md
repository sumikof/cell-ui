# アーキテクチャ

## ディレクトリ構成

```
src/
  model/          型、A1 アドレス、スパースなシートモデル(トランザクション / Undo / Redo)、入力規則
  clipboard/      Excel 互換 TSV / HTML のシリアライズとパース、貼り付け範囲の計算
  keyboard/       キーコンボの解釈とキーマップ
  render/         仮想スクロール描画(セル・ヘッダー・罫線・選択・エディタ)、軸レイアウト
  ui/             ツールバー、カラーピッカー、コンテキストメニュー、数式バー、ステータスバー、ドロップダウン
  defaults/       既定のコマンド・キー割り当て・ツールバー項目・メニュー項目
  plugins/        拡張 API の型定義
  spreadsheet.ts  すべてを束ねるコンポーネント
  element.ts      Web Component <cell-ui-sheet>
  i18n.ts         UI 文言(ja / en)
  styles.css      スタイル
examples/         デモ(demo.ts)と数式プラグインのサンプル
docs/             ドキュメント(en / ja)
test/             vitest ユニットテスト
scripts/e2e.mjs   Chromium での動作確認
index.html        デモページ
embed.html        埋め込みサンプル
```

## レイヤー

```
Spreadsheet (controller)
 ├─ SheetModel        値・書式・meta・サイズ・入力規則 / トランザクション / Undo
 ├─ Selection         アクティブセル・範囲・モード
 ├─ CommandRegistry   すべての操作
 ├─ Keymap            キー → コマンド
 ├─ ClipboardState    直前のコピー内容
 ├─ GridView          DOM 描画とマウス操作
 └─ Toolbar / FormulaBar / StatusBar / ContextMenu
```

- **モデルは UI を知らない**。`SheetModel` は DOM に依存せず、Node.js 単体でも使えます。
- **すべての変更はトランザクション**。公開メソッドは暗黙に 1 つのトランザクションを開き、`transact()` でまとめると 1 回の Undo になります。トランザクションはセル・サイズ・寸法・入力規則の before/after を記録し、終了時に 1 回だけ `change` を発火します。
- **操作はコマンド**。キー入力・ツールバー・メニューはすべて `commands.execute()` に集約され、差し替え可能です。

## 描画(`GridView`)

- 行・列の位置は `AxisLayout`(累積オフセット)で管理し、二分探索で座標 → インデックスを求めます。サイズ変更時に `invalidateLayout()` で再計算します。
- 表示範囲のセルだけを DOM 要素として生成し、キー(`"row,col"`)付きのプールで再利用します。描画は `requestAnimationFrame` でまとめます。
- レイヤー構成(下から): 枠線 → セル(塗りつぶし + テキスト) → 罫線 → オーバーレイ(選択範囲、アクティブ枠、フィルハンドル、切り取りマーキー、入力規則エラー、▾ ボタン) → エディタ。
- 左揃えのテキストは Excel と同様に右隣の空セルへはみ出して表示します(幅は Canvas の `measureText` で計測)。
- ヘッダーは別要素で、スクロールに合わせて `transform` で追従します。ヘッダー非表示時はサイズ 0 になります。
- `fitContent` ではグリッド要素の幅・高さを内容に合わせ、ビューポートのスクロールを無効にします。

## 編集とキー入力

- グリッド内の `textarea.cui-editor` が常にフォーカスを持ちます。非編集時は不可視で、番兵文字(空白)を選択状態にしておくことで、文字キーの `input` イベントをそのまま「入力開始」として扱えます。この方式により IME の変換もそのまま動作します。
- `keydown` はキーマップで解決し、コマンドが処理した場合のみ `preventDefault` します。編集モード(`'enter'` / `'edit'` / `'formula'`)によって矢印キーの扱いが変わります。
- 確定時は `parseInput()`(値パーサのチェーン)→ 入力規則の検証 → モデルへの書き込みの順に処理します。

## クリップボード

- キーボード操作では、ブラウザの `copy` / `cut` / `paste` イベントを非表示エディタで受け取り、`clipboardData` に TSV と HTML を書き込みます(権限不要)。
- メニュー / ボタンからは非同期 Clipboard API を使い、失敗時は `execCommand` や内部ペイロードにフォールバックします。
- 貼り付けは「内部ペイロード(テキストが一致) → HTML の `<table>` → TSV」の順に解釈します。

## Web Component

- `CellUiElement` は Shadow Root に CSS を注入し、その中に `Spreadsheet` を生成します。属性の変更は `attributeChangedCallback` で `setVisible()` などに反映します。
- ポップオーバーは `popoverHost`(Shadow Root)に追加し、フォーカス判定は `getRootNode().activeElement` を使います。

## 設計上の制約

- 選択は単一の矩形(+ 行 / 列 / 全体モード)です。複数範囲選択は未対応です。
- セル結合、フリーズペイン、複数シート、数式は未対応です(数式はプラグインで追加可能)。
- 行数は数十万程度まで(累積オフセットの再計算が O(n))を想定しています。
