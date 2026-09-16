/**
 * Keyboard shortcut registry.
 *
 * Bindings are written like `"Ctrl+Shift+ArrowDown"`, `"Mod+C"`, `"F2"`,
 * `"Alt+Enter"`. `Mod` means Ctrl on Windows/Linux and ⌘ on macOS. Special
 * names: `Space`, `Plus`, `Minus`, `Enter`, `Escape`, `Tab`, `Delete`,
 * `Backspace`, `Home`, `End`, `PageUp`, `PageDown`, `ArrowUp`… Letters are
 * case-insensitive; other single characters are matched against `event.key`
 * and ignore the Shift flag (so `"Ctrl+:"` works on any layout).
 *
 * Each binding applies in a context: `grid` (default; not editing), `edit`
 * (while the in-cell editor is open) or `always`.
 */

export type KeyContext = 'grid' | 'edit' | 'always';

export interface KeyBinding {
  combo: string;
  command: string;
  when: KeyContext;
  /** Optional argument passed to the command. */
  args?: unknown;
}

interface ParsedCombo {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
  /** Shift is "don't care" for punctuation keys. */
  shiftAny: boolean;
}

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  space: ' ',
  spacebar: ' ',
  plus: '+',
  minus: '-',
  pgup: 'pageup',
  pgdn: 'pagedown',
};

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const p = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(p);
}

export function parseCombo(combo: string, mac = isMacPlatform()): ParsedCombo {
  const parts = combo.split('+').map((p) => p.trim());
  // "Ctrl++" → ["Ctrl", "", ""] : treat trailing empties as a literal "+".
  const tokens: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '' && i > 0) {
      if (tokens[tokens.length - 1] !== '+') tokens.push('+');
      continue;
    }
    tokens.push(parts[i]);
  }
  const out: ParsedCombo = { ctrl: false, shift: false, alt: false, meta: false, key: '', shiftAny: false };
  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (t === 'ctrl' || t === 'control') out.ctrl = true;
    else if (t === 'shift') out.shift = true;
    else if (t === 'alt' || t === 'option') out.alt = true;
    else if (t === 'meta' || t === 'cmd' || t === 'command' || t === 'win') out.meta = true;
    else if (t === 'mod') {
      if (mac) out.meta = true;
      else out.ctrl = true;
    } else out.key = KEY_ALIASES[t] ?? t;
  }
  if (out.key.length === 1 && !/[a-z0-9 ]/.test(out.key) && !out.shift) out.shiftAny = true;
  return out;
}

export interface KeyEventLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

function eventKey(e: KeyEventLike): string {
  let k = e.key;
  if (k === 'Spacebar') k = ' ';
  if (k === 'Esc') k = 'Escape';
  if (k === 'Del') k = 'Delete';
  // Dead/composition keys are ignored by callers.
  if (k.length === 1) return k.toLowerCase();
  return k.toLowerCase();
}

export function comboMatches(parsed: ParsedCombo, e: KeyEventLike): boolean {
  if (parsed.ctrl !== e.ctrlKey) return false;
  if (parsed.alt !== e.altKey) return false;
  if (parsed.meta !== e.metaKey) return false;
  if (!parsed.shiftAny && parsed.shift !== e.shiftKey) return false;
  const k = eventKey(e);
  if (k === parsed.key) return true;
  // Digit keys with Shift produce symbols on many layouts (e.g. Ctrl+Shift+5); use code as fallback.
  if (/^[0-9]$/.test(parsed.key) && e.code === `Digit${parsed.key}`) return true;
  if (parsed.key === '+' && (e.code === 'NumpadAdd' || (e.code === 'Equal' && e.shiftKey))) return true;
  if (parsed.key === '-' && (e.code === 'NumpadSubtract' || e.code === 'Minus')) return true;
  return false;
}

export class Keymap {
  private bindings: (KeyBinding & { parsed: ParsedCombo })[] = [];

  constructor(private readonly mac: boolean = isMacPlatform()) {}

  bind(combo: string | string[], command: string, options: { when?: KeyContext; args?: unknown } = {}): () => void {
    const combos = Array.isArray(combo) ? combo : [combo];
    const added = combos.map((c) => {
      const binding: KeyBinding & { parsed: ParsedCombo } = { combo: c, command, when: options.when ?? 'grid', args: options.args, parsed: parseCombo(c, this.mac) };
      // Later bindings take precedence, so insert at the front.
      this.bindings.unshift(binding);
      return binding;
    });
    return () => {
      this.bindings = this.bindings.filter((b) => !added.includes(b));
    };
  }

  /** Remove every binding for a combo (optionally within a context). */
  unbind(combo: string, when?: KeyContext): void {
    const p = parseCombo(combo, this.mac);
    this.bindings = this.bindings.filter(
      (b) => !(b.parsed.key === p.key && b.parsed.ctrl === p.ctrl && b.parsed.shift === p.shift && b.parsed.alt === p.alt && b.parsed.meta === p.meta && (!when || b.when === when)),
    );
  }

  /** Remove every binding that triggers `command`. */
  unbindCommand(command: string): void {
    this.bindings = this.bindings.filter((b) => b.command !== command);
  }

  resolve(e: KeyEventLike, context: 'grid' | 'edit'): KeyBinding | null {
    for (const b of this.bindings) {
      if (b.when !== 'always' && b.when !== context) continue;
      if (comboMatches(b.parsed, e)) return b;
    }
    return null;
  }

  list(): KeyBinding[] {
    return this.bindings.map(({ combo, command, when, args }) => ({ combo, command, when, args }));
  }
}
