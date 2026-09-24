# ショートカットキー

Excel のショートカットを踏襲しています。macOS では Ctrl の代わりに ⌘ を使います(バインディングの `Mod` 修飾子)。すべてのキーは `sheet.keymap` で変更できます([拡張](./extensibility.md#キーマップ))。

## 移動・選択

| キー | 動作 | コマンド |
| --- | --- | --- |
| ↑ ↓ ← → | 移動 | `nav.move` |
| Shift+矢印 | 選択範囲を拡張 | `nav.move` (`extend`) |
| Ctrl+矢印 | データの端へジャンプ(連続データの端 → 次のデータ → シートの端) | `nav.move` (`jump`) |
| Ctrl+Shift+矢印 | 端まで選択 | `nav.move` (`jump`, `extend`) |
| Tab / Shift+Tab | 右 / 左へ移動。複数選択中は範囲内を巡回 | `nav.tab` |
| Enter / Shift+Enter | 下 / 上へ移動。Tab で移動した後の Enter は Tab を始めた列に戻る。複数選択中は範囲内を巡回 | `nav.enter` |
| Home / Shift+Home | 行頭へ / 行頭まで選択 | `nav.home` |
| Ctrl+Home / Ctrl+Shift+Home | A1 へ / A1 まで選択 | `nav.home` (`ctrl`) |
| Ctrl+End / Ctrl+Shift+End | 最終使用セルへ / まで選択 | `nav.end` |
| End / Shift+End | 行の最終データへ | `nav.rowEnd` |
| PageUp / PageDown (+Shift) | 1 画面上下 | `nav.page` |
| Alt+PageUp / Alt+PageDown (+Shift) | 1 画面左右 | `nav.page` |
| Ctrl+A | 現在の領域を選択 → もう一度で全選択 | `select.all` |
| Ctrl+Shift+Space | 全選択 | `select.all` (`force`) |
| Ctrl+Shift+* (Ctrl+Shift+8) | 現在の領域を選択 | `select.currentRegion` |
| Shift+Space | 行全体を選択 | `select.row` |
| Ctrl+Space | 列全体を選択(行選択中なら全選択) | `select.column` |

## 編集

| キー | 動作 | コマンド |
| --- | --- | --- |
| 文字キー | 入力開始(Enter モード) | – |
| F2 | 編集開始(編集モード)。編集中は Enter モードと編集モードを切り替え | `edit.start` / `edit.toggleMode` |
| Enter / Shift+Enter | 確定して下 / 上へ | `edit.commit` |
| Tab / Shift+Tab | 確定して右 / 左へ | `edit.commit` |
| Ctrl+Enter | 確定してその場に留まる。複数選択中は選択範囲すべてに同じ値を入力 | `edit.commit` (`fillSelection`) |
| Alt+Enter | セル内改行 | `edit.newline` |
| Esc | 編集の取り消し | `edit.cancel` |
| Delete | 選択範囲の内容をクリア(書式は残る) | `cell.clear` |
| Backspace | アクティブセルをクリアして編集開始 | `cell.backspace` |
| Ctrl+; | 今日の日付を入力 | `insert.date` |
| Ctrl+: (Ctrl+Shift+;) | 現在時刻を入力 | `insert.time` |
| Alt+↓ | 入力規則(リスト)のドロップダウンを開く | `validation.openList` |

### Enter モードと編集モード

Excel と同じく、編集の開始方法で矢印キーの動作が変わります。

- **Enter モード**(文字キーで入力を始めた場合): 矢印キーで確定して移動します。
- **編集モード**(F2 / ダブルクリック / 数式バー): 矢印キーはカーソルを動かします。F2 でモードを切り替えられます。

IME(日本語入力)の変換中の Enter は確定として扱われません。

## クリップボード

| キー | 動作 | コマンド |
| --- | --- | --- |
| Ctrl+C / Ctrl+Insert | コピー(Excel 互換の TSV + HTML) | `clipboard.copy` |
| Ctrl+X / Shift+Delete | 切り取り(貼り付け時に元を消去。Esc で解除) | `clipboard.cut` |
| Ctrl+V / Shift+Insert | 貼り付け(書式付き) | `clipboard.paste` |
| Ctrl+Shift+V | 値のみ貼り付け | `clipboard.pasteValues` |
| Esc | 切り取りの解除 | `clipboard.cancelCut` |

詳細は [クリップボード](./clipboard.md) を参照してください。

## 書式

| キー | 動作 | コマンド |
| --- | --- | --- |
| Ctrl+B / Ctrl+2 | 太字 | `format.toggle` (`bold`) |
| Ctrl+I / Ctrl+3 | 斜体 | `format.toggle` (`italic`) |
| Ctrl+U / Ctrl+4 | 下線 | `format.toggle` (`underline`) |
| Ctrl+5 | 取り消し線 | `format.toggle` (`strikethrough`) |
| Ctrl+Shift+& (Ctrl+Shift+7) | 外枠罫線 | `format.borders` (`outside`) |
| Ctrl+Shift+_ (Ctrl+Shift+-) | 罫線を削除 | `format.borders` (`none`) |
| Ctrl+Shift+> / Ctrl+Shift+< | フォントサイズ拡大 / 縮小 | `format.fontSize` |
| Ctrl+1 | 書式設定(ツールバーへフォーカス) | `format.dialog` |

書式のショートカットは編集中でも有効です(`when: 'always'`)。

## フィル・構造・履歴

| キー | 動作 | コマンド |
| --- | --- | --- |
| Ctrl+D | 上のセルを下方向にコピー | `fill.down` |
| Ctrl+R | 左のセルを右方向にコピー | `fill.right` |
| Ctrl++ | 行を挿入(列選択中は列を挿入) | `structure.insert` |
| Ctrl+- | 行を削除(列選択中は列を削除) | `structure.delete` |
| Ctrl+9 / Ctrl+Shift+9 | 行を非表示 / 再表示 | `rows.hide` / `rows.unhide` |
| Ctrl+0 / Ctrl+Shift+0 | 列を非表示 / 再表示 | `columns.hide` / `columns.unhide` |
| Ctrl+Z | 元に戻す | `history.undo` |
| Ctrl+Y / Ctrl+Shift+Z | やり直し | `history.redo` |

## マウス操作

| 操作 | 動作 |
| --- | --- |
| クリック / ドラッグ | 選択。Shift+クリックで拡張。端までドラッグすると自動スクロール |
| ダブルクリック | 編集モードで編集開始 |
| 行番号 / 列名クリック・ドラッグ | 行 / 列全体を選択。左上の角で全選択 |
| ヘッダー境界のドラッグ / ダブルクリック | サイズ変更 / 自動調整 |
| フィルハンドル(選択範囲右下)のドラッグ | 連続データ・パターンのコピー |
| 右クリック | コンテキストメニュー |
| リストセルの ▾ ボタン | 入力規則のドロップダウン |

## キーの記法

`keymap.bind('Ctrl+Shift+ArrowDown', 'cmd')` のように書きます。`Mod` は Windows/Linux で Ctrl、macOS で ⌘ になります。特殊キー名: `Enter` `Escape` `Tab` `Delete` `Backspace` `Space` `Plus` `Minus` `Home` `End` `PageUp` `PageDown` `ArrowUp` … `F1`〜`F12`。記号キー(`;` `:` など)は Shift の有無を区別しないため、キーボード配列が違っても動作します。
