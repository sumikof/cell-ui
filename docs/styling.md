# スタイル(書式)

## `CellStyle`

セルの書式は `CellStyle` オブジェクトで表し、未指定の項目はシート既定(`defaultStyle`)を継承します。

| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `fontFamily` | `string` | フォント(CSS の `font-family` と同じ記法) |
| `fontSize` | `number` | ポイント(pt)。Excel と同じ単位 |
| `bold` / `italic` / `underline` / `strikethrough` | `boolean` | 太字 / 斜体 / 下線 / 取り消し線 |
| `color` | `string` | 文字色(CSS カラー) |
| `backgroundColor` | `string` | 塗りつぶし |
| `hAlign` | `'left' \| 'center' \| 'right'` | 水平配置。未指定なら数値は右、真偽値は中央、文字列は左 |
| `vAlign` | `'top' \| 'middle' \| 'bottom'` | 垂直配置(既定 bottom) |
| `wrap` | `boolean` | 折り返し |
| `borderTop` / `borderRight` / `borderBottom` / `borderLeft` | `{ style, color }` | 罫線。`style` は `thin` `medium` `thick` `dashed` `dotted` `double` `none` |
| `numberFormat` | `string` | 数値書式文字列。コアは解釈しないが Excel との往復で保持される(プラグイン用) |

```ts
sheet.model.setStyle(0, 0, { bold: true, color: '#c00000' });                 // 1 セルにマージ
sheet.model.applyStyle(range, { backgroundColor: '#fff2cc', hAlign: 'center' }); // 範囲に適用
sheet.applyStyle({ italic: true });                                            // 現在の選択範囲に適用
sheet.toggleStyle('bold');                                                     // アクティブセルの状態を基準にトグル
sheet.model.setStyle(0, 0, { bold: undefined });                               // 項目を削除
sheet.model.clearRange(range, { styles: true });                               // 書式のクリア
```

`defaultStyle` オプションでシート全体の既定を変えられます。

```ts
new Spreadsheet(el, { defaultStyle: { fontFamily: 'Meiryo', fontSize: 10 } });
```

## 罫線

`applyBorderPreset(sheet, range, preset)` または `format.borders` コマンドで、Excel の罫線メニューと同じプリセットを適用できます。

| プリセット | 内容 |
| --- | --- |
| `all` | 格子 |
| `outside` | 外枠 |
| `thickOutside` | 太い外枠 |
| `inside` | 内側 |
| `top` / `bottom` / `left` / `right` | 一辺 |
| `none` | 枠なし(隣接セルの共有辺も消す) |

```ts
import { applyBorderPreset } from 'cell-ui';
applyBorderPreset(sheet, sheet.selection.range, 'outside', '#000000');
sheet.commands.execute('format.borders', { args: 'all' });
```

画面上では罫線をセルとは別のレイヤーに描くため、隣接セルの塗りつぶしに隠れません。

## ツールバー

既定のツールバーには次の項目があります(左から)。

| ID | 内容 |
| --- | --- |
| `undo` / `redo` | 元に戻す / やり直し |
| `fontFamily` | フォント(入力可能なコンボボックス、`FONT_FAMILIES`) |
| `fontSize` | フォントサイズ(`FONT_SIZES`) |
| `bold` / `italic` / `underline` / `strikethrough` | 文字飾り |
| `borders` | 罫線メニュー |
| `fontColor` / `fillColor` | 文字色 / 塗りつぶし(スプリットボタン。▾ で Excel テーマ色のパレット、「その他の色」でカラーピッカー) |
| `alignTop` / `alignMiddle` / `alignBottom` | 垂直配置 |
| `alignLeft` / `alignCenter` / `alignRight` | 水平配置 |
| `wrap` | 折り返し |
| `clearFormats` | 書式のクリア |

項目の追加・削除は [拡張](./extensibility.md#ツールバー) を参照してください。`sheet.toolbar.remove('strikethrough')` のように既定項目を消すこともできます。

## 数値の表示

数値は Excel の「標準」書式に近い形(有効数字 11 桁まで)で表示され、右揃えになります。`numberFormat` を解釈して表示を変えたい場合は `addDisplayResolver` で表示文字列を差し替えます([拡張](./extensibility.md#表示と入力のフック))。

## テーマ

すべてのクラスは `cui-` プレフィックス付きです。色や既定フォントは `.cui-root` の CSS 変数で上書きできます。

```css
.cui-root {
  --cui-font: "Segoe UI", "Yu Gothic", sans-serif;
  --cui-accent: #1a73e8;                  /* 選択枠・ヘッダーの強調色 */
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

Web Component(Shadow DOM)の場合は `::part` を公開していないため、`injectStyles(shadowRoot)` の後に追加の `<style>` を Shadow Root に入れるか、`CELL_UI_CSS` を元に独自の CSS を用意してください。

主なクラス:

| クラス | 要素 |
| --- | --- |
| `.cui-root` | ルート。`.cui-root--focused` `.cui-root--editing` `.cui-root--fit-height` `.cui-root--fit-width` が付く |
| `.cui-toolbar` `.cui-tb-btn` `.cui-tb-btn--active` | ツールバー |
| `.cui-formulabar` `.cui-namebox` `.cui-formula-input` | 数式バー |
| `.cui-grid` `.cui-viewport` `.cui-canvas` | グリッド |
| `.cui-header` `.cui-header-col` `.cui-header-row` `.cui-header--selected` `.cui-header--full` | ヘッダー |
| `.cui-cell` `.cui-cell-text` `.cui-cell--active` `.cui-cell--invalid` | セル |
| `.cui-range` `.cui-active` `.cui-fill-handle` `.cui-cut-marquee` | 選択オーバーレイ |
| `.cui-editor` `.cui-editor--open` | セル内エディタ |
| `.cui-menu` `.cui-popover` `.cui-dropdown` `.cui-validation-error` | ポップオーバー |
| `.cui-statusbar` | ステータスバー |
