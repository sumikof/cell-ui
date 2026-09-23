# API リファレンス

型の詳細は `dist/index.d.ts` を参照してください。ここでは主要なクラスの公開メンバーをまとめます。

## `Spreadsheet`

```ts
new Spreadsheet(container: HTMLElement, options?: SpreadsheetOptions)
createSpreadsheet(container, options)   // 同等のファクトリ
```

### プロパティ

| 名前 | 型 | 説明 |
| --- | --- | --- |
| `model` | `SheetModel` | データ・書式・入力規則・Undo |
| `selection` | `Selection` | 選択状態 |
| `commands` | `CommandRegistry<Spreadsheet>` | コマンド |
| `keymap` | `Keymap` | キー割り当て |
| `toolbar` / `contextMenu` / `formulaBar` / `statusBar` | UI クラス | 各部品 |
| `grid` | `GridView` | 描画エンジン |
| `clipboard` | `ClipboardState` | 直前のコピー / 切り取り状態 |
| `events` | `Emitter<SpreadsheetEvents>` | イベント |
| `options` | `SpreadsheetOptions` | 現在のオプション(表示切り替えで更新される) |
| `strings` | `Strings` | 現在の UI 文言 |
| `root` | `HTMLElement` | ルート要素 `.cui-root` |
| `isMac` | `boolean` | macOS 判定(⌘ の扱い) |
| `popoverHost` | `HTMLElement \| ShadowRoot` | ポップオーバーの追加先 |
| `activeElement` | `Element \| null` | Shadow DOM を考慮したフォーカス要素 |
| `hasFocus` | `boolean` | コンポーネント内にフォーカスがあるか |
| `activeRef` | `string` | アクティブセルの A1 参照 |

### 編集

| メソッド | 説明 |
| --- | --- |
| `isEditing` / `editMode` / `editorText` | 編集状態(`'enter' \| 'edit' \| 'formula' \| null`) |
| `startEdit(mode = 'edit', initialText?)` | 編集開始 |
| `commitEdit({ fillSelection? })` | 確定。入力規則違反や未編集なら `false` |
| `cancelEdit()` | 取り消し |
| `setEditMode(mode)` / `toggleEditMode()` | モード切り替え |
| `setEditorText(text)` / `insertEditorText(text)` | エディタ文字列の操作 |
| `enterText(text)` | アクティブセルにテキストを入力して確定(編集中なら挿入) |
| `focus()` | キーボード入力を受け付ける状態にする |

### 移動・選択

| メソッド | 説明 |
| --- | --- |
| `goTo(address, extend?)` | 移動してスクロール |
| `moveActive(dRow, dCol, { extend?, jump? })` | 矢印キー相当 |
| `jumpTarget(from, dRow, dCol)` | Ctrl+矢印の移動先を計算 |
| `tabMove(±1)` / `enterMove(±1)` | Tab / Enter 相当 |
| `isSelected(address)` | 選択範囲に含まれるか |

### 書式

| メソッド | 説明 |
| --- | --- |
| `applyStyle(patch)` | 選択範囲に書式を適用 |
| `toggleStyle('bold' \| 'italic' \| 'underline' \| 'strikethrough' \| 'wrap')` | トグル |

### クリップボード・フィル

| メソッド | 説明 |
| --- | --- |
| `copyToClipboard(cut, event?)` | コピー / 切り取り |
| `pasteFromClipboard({ valuesOnly?, event? })` | 貼り付け |
| `pasteData({ html?, text? }, { valuesOnly? })` | 任意データの貼り付け |
| `pasteBlock(parsed)` | 解析済みブロックの貼り付け |
| `fillRange(source, target, { series? })` | フィル(連続データ) |

### レイアウトと表示

| メソッド | 説明 |
| --- | --- |
| `appendRows(n)` / `appendColumns(n)` | 末尾に追加 |
| `setVisible(part, visible)` / `isVisible(part)` | UI 部品の表示切り替え。`part`: `'toolbar' \| 'formulaBar' \| 'nameBox' \| 'formulaInput' \| 'statusBar' \| 'contextMenu' \| 'headers' \| 'rowHeaders' \| 'columnHeaders' \| 'gridlines' \| 'fillHandle'` |
| `formulaBarParts()` | `{ nameBox, input }` の表示状態 |
| `isFixedWidth` | `fitContent` が `true` / `'width'` か |
| `columnLabel(col)` / `setColumnLabels(labels)` | 列名 |

### 入力規則

| メソッド | 説明 |
| --- | --- |
| `registerValidator(type, fn)` | 規則タイプの登録(解除関数を返す) |
| `getValidation(address)` | 適用中の規則 |
| `validate(address, value)` | エラーメッセージ or `null` |
| `isInvalid(address)` | 保存済みの値が違反か |
| `validateAll()` | 違反セルの一覧 |
| `showValidationError(address, message)` / `hideValidationError()` | エラー表示 |
| `openListDropdown()` / `closeListDropdown()` | リストのドロップダウン |

### 拡張

| メソッド | 説明 |
| --- | --- |
| `use(plugin)` / `removePlugin(name)` | プラグイン |
| `addValueParser` / `addDisplayResolver` / `addEditTextResolver` / `addCellRenderer` | フック(解除関数を返す) |
| `displayText(address, cell?)` / `editText(address)` / `parseInput(text, address)` | フックを通した変換 |

### 永続化・破棄

| メソッド | 説明 |
| --- | --- |
| `toJSON()` | スナップショット |
| `load(snapshot)` | 置き換え(1 回の Undo で戻せる) |
| `destroy()` | DOM・イベント・`window` リスナを解放 |

## `SheetModel`

```ts
new SheetModel({ rows?, cols?, defaultColumnWidth?, defaultRowHeight?, historyLimit?, defaultStyle? })
```

| メンバー | 説明 |
| --- | --- |
| `rowCount` / `colCount` / `cellCount` | サイズ |
| `getCell(r, c)` / `getValue(r, c)` / `getStyle(r, c)` / `getEffectiveStyle(r, c)` | 読み取り(`getCell` の戻り値は変更しないこと) |
| `entries()` | 非空セルのイテレータ `[address, data]` |
| `usedRange()` / `hasContent(r, c)` | 使用範囲 |
| `setCell(r, c, data \| null)` / `setValue(r, c, value)` / `setStyle(r, c, patch)` / `setMeta(r, c, patch \| null)` | 書き込み(未指定の項目は保持) |
| `setCells(origin, block)` / `getCells(range)` | 2 次元ブロック |
| `applyStyle(range, patch)` / `clearRange(range, { values?, styles?, meta? })` | 範囲操作 |
| `getColumnWidth(c)` / `setColumnWidth(c, w \| undefined)` / `getRowHeight(r)` / `setRowHeight(r, h \| undefined)` | サイズ(0 で非表示) |
| `insertRows(at, n)` / `deleteRows(at, n)` / `insertColumns(at, n)` / `deleteColumns(at, n)` / `appendRows(n)` / `appendColumns(n)` | 構造変更 |
| `ensureSize(rows, cols)` / `resize(rows, cols)` | サイズ変更 |
| `setValidation(range, rule \| null)` / `getValidation(r, c)` / `getValidations()` / `clearValidations()` | 入力規則 |
| `transact(label, fn)` | 複数の変更を 1 回の Undo にまとめる(ネスト可) |
| `undo()` / `redo()` / `canUndo` / `canRedo` / `clearHistory()` | 履歴 |
| `toJSON()` / `load(snapshot)` | 永続化 |
| `events` | `change` / `history` |
| `defaultStyle` / `defaultColumnWidth` / `defaultRowHeight` | 既定値 |

## `Selection`

| メンバー | 説明 |
| --- | --- |
| `active` / `range` / `anchor` / `mode` / `isSingleCell` | 状態 |
| `setActive(address)` | 1 セル選択 |
| `extendTo(address)` | アンカーから拡張 |
| `selectRange(range, active?, mode?)` | 任意の範囲 |
| `selectRows(from, to?, activeCol?)` / `selectColumns(from, to?, activeRow?)` / `selectAll()` | 行 / 列 / 全体 |
| `moveActiveWithin(dRow, dCol)` | 範囲内でアクティブセルを巡回 |
| `revalidate()` | サイズ変更後の補正 |
| `snapshot()` | 状態のコピー |
| `events` | `change` |

## `CellUiElement`(`<cell-ui-sheet>`)

| メンバー | 説明 |
| --- | --- |
| `sheet` | `Spreadsheet \| null` |
| `whenReady` | `Promise<Spreadsheet>` |
| `options` | 接続前に設定する追加オプション |
| `data` | スナップショットの取得 / 設定 |
| `appendRows(n)` / `appendColumns(n)` / `focus()` | 操作 |
| `defineCellUiElement(tagName?)` | 登録(自動で `cell-ui-sheet` として登録済み) |
| `injectStyles(target)` / `CELL_UI_CSS` | スタイルの注入 |

属性・イベントは [オプション一覧](./options.md#web-component-固有) を参照してください。

## ユーティリティ

| 関数 | 説明 |
| --- | --- |
| `columnLabel(col)` / `columnIndex('AB')` | 列番号 ⇔ 英字 |
| `addressToA1(addr)` / `a1ToAddress('B3')` / `a1ToRange('A1:C3')` / `rangeToA1(range)` | A1 参照 |
| `normalizeRange` / `rangeContains` / `rangeSize` / `iterateRange` / `sameAddress` / `sameRange` | 範囲操作 |
| `columnRange(col, toCol?)` / `rowRange(row, toRow?)` | 入力規則用の列 / 行全体 |
| `parseInputValue(text)` / `formatValue(value)` / `editableText(cell)` | 値の変換 |
| `buildClipboardPayload` / `parseHtmlTable` / `parseTsv` / `serializeHtml` / `serializeTsv` / `styleToCss` / `computePasteRange` / `tileBlock` | クリップボード |
| `applyBorderPreset(sheet, range, preset, color?)` / `currentRegion(sheet, range)` | 書式 / 領域 |
| `parseCombo` / `comboMatches` / `isMacPlatform` | キー入力 |
| `getStrings(locale)` / `registerLocale(code, strings)` | UI 文言 |
| `THEME_COLORS` / `STANDARD_COLORS` / `FONT_FAMILIES` / `FONT_SIZES` | 既定の選択肢 |
