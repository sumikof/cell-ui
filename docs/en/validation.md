# Validation

The equivalent of Excel's "Data Validation." When you set a rule on a range, input is validated on commit; invalid input is rejected with an error message and the cell stays in edit mode.

## Rule types

### Numbers only (`number`)

```ts
{ type: 'number', min?: number, max?: number, integer?: boolean, allowBlank?: boolean, message?: string }
```

| Property | Description |
| --- | --- |
| `min` / `max` | Lower / upper bound (specifying both produces a "between A and B" message) |
| `integer` | Integers only |
| `allowBlank` | Allow blank cells (default: true) |
| `message` | Text shown instead of the default message |

### List selection (`list`)

```ts
{ type: 'list', options: (string | number)[], allowOther?: boolean, dropdown?: boolean, allowBlank?: boolean, message?: string }
```

| Property | Description |
| --- | --- |
| `options` | The choices |
| `allowOther` | Also allow values not in the list (default: false) |
| `dropdown` | Show a ▾ button next to the cell (default: true). Alt+↓ works whether or not the button is shown |

## Specifying ranges

```ts
import { columnRange, rowRange } from 'cell-ui';

sheet.model.setValidation(columnRange(1), { type: 'number', min: 0, integer: true });        // Entire column B
sheet.model.setValidation(columnRange(2, 3), { type: 'list', options: ['A', 'B'] });          // Columns C–D
sheet.model.setValidation(rowRange(0), { type: 'list', options: ['Heading'] });               // Entire row 1
sheet.model.setValidation({ start: { row: 1, col: 4 }, end: { row: 99, col: 4 } }, rule);   // E2:E100
sheet.model.setValidation(columnRange(1), null);                                             // Remove
sheet.model.clearValidations();                                                              // Remove all
```

- Rules set later take precedence (overlapping areas are overwritten).
- `columnRange` / `rowRange` represent "entire column" / "entire row," so the rule also applies to rows and columns added later.
- Ranges shift automatically when rows or columns are inserted or deleted.
- Rules are covered by Undo/Redo and included in `toJSON()` / `load()` (the `validations` array).

## Behavior

| Situation | Behavior |
| --- | --- |
| Commit (Enter / Tab / arrows / formula bar / Ctrl+Enter) | Validates; if invalid, shows an error below the cell and stays in edit mode. Esc cancels. Fires the `validationerror` event |
| Selecting a list cell | A ▾ button appears next to the cell. Click it or press Alt+↓ to open the dropdown (↑↓ / Home / End / Enter / Esc) |
| Writes via paste / fill / API | Not blocked (same as Excel). Invalid cells get a red marker in the top-right corner |
| `sheet.validateAll()` | Returns a list of invalid cells, `{ address, message }[]` |

```ts
sheet.events.on('validationerror', ({ address, value, message, rule }) => { … });
sheet.validate({ row: 3, col: 1 }, 'abc');   // 'Please enter a number.' / null
sheet.isInvalid({ row: 3, col: 1 });         // Whether the stored value violates the rule
sheet.getValidation({ row: 3, col: 1 });     // The rule currently in effect
sheet.openListDropdown();                    // Open the active cell's list (false if there is no rule)
```

Error messages are built in for Japanese and English (`locale`). You can add other languages with `registerLocale()`.

## Custom rules

Add new rule types with `registerValidator(type, fn)`. `fn` returns an error message (string) or `null` (valid).

```ts
sheet.registerValidator('email', (value, rule, address, sheet) =>
  value === null || value === '' || /^[^@\s]+@[^@\s]+$/.test(String(value)) ? null : 'Please enter an email address.',
);
sheet.model.setValidation(columnRange(5), { type: 'email' });
```

You can also register validators from a plugin's `install()` and remove them with the returned cleanup function. The built-in `number` / `list` types can be overridden by registering under the same name.

## Notes

- Rules are evaluated against the "value." If a plugin stores formulas in `meta`, `cell.value` is validated, not the displayed value.
- Blank handling is controlled by `allowBlank`. Blanks are allowed by default.
- To check for violations after bulk-updating many cells, use `validateAll()`. On-screen markers are drawn only for visible cells.
