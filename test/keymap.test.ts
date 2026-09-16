import { describe, it, expect } from 'vitest';
import { Keymap, parseCombo, comboMatches } from '../src/keyboard/keymap';

const ev = (key: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; code: string }> = {}) => ({
  key,
  code: mods.code,
  ctrlKey: !!mods.ctrl,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
  metaKey: !!mods.meta,
});

describe('Keymap', () => {
  it('parses combos', () => {
    expect(parseCombo('Ctrl+Shift+ArrowDown', false)).toMatchObject({ ctrl: true, shift: true, key: 'arrowdown' });
    expect(parseCombo('Mod+C', false)).toMatchObject({ ctrl: true, meta: false, key: 'c' });
    expect(parseCombo('Mod+C', true)).toMatchObject({ ctrl: false, meta: true, key: 'c' });
    expect(parseCombo('Ctrl++', false)).toMatchObject({ ctrl: true, key: '+' });
    expect(parseCombo('Mod+Plus', false)).toMatchObject({ ctrl: true, key: '+' });
    expect(parseCombo('Shift+Space', false)).toMatchObject({ shift: true, key: ' ' });
  });

  it('matches events', () => {
    expect(comboMatches(parseCombo('Ctrl+B', false), ev('b', { ctrl: true }))).toBe(true);
    expect(comboMatches(parseCombo('Ctrl+B', false), ev('B', { ctrl: true, shift: true }))).toBe(false);
    expect(comboMatches(parseCombo('Ctrl+:', false), ev(':', { ctrl: true, shift: true }))).toBe(true);
    expect(comboMatches(parseCombo('Ctrl+Shift+5', false), ev('%', { ctrl: true, shift: true, code: 'Digit5' }))).toBe(true);
    expect(comboMatches(parseCombo('Ctrl+Plus', false), ev('+', { ctrl: true, shift: true, code: 'Equal' }))).toBe(true);
    expect(comboMatches(parseCombo('Ctrl+Plus', false), ev('+', { ctrl: true, code: 'NumpadAdd' }))).toBe(true);
    expect(comboMatches(parseCombo('F2', false), ev('F2'))).toBe(true);
    expect(comboMatches(parseCombo('Enter', false), ev('Enter', { shift: true }))).toBe(false);
  });

  it('resolves by context with later bindings winning', () => {
    const km = new Keymap(false);
    km.bind('Enter', 'a');
    km.bind('Enter', 'b', { when: 'edit' });
    km.bind('Mod+Z', 'undo', { when: 'always' });
    expect(km.resolve(ev('Enter'), 'grid')?.command).toBe('a');
    expect(km.resolve(ev('Enter'), 'edit')?.command).toBe('b');
    expect(km.resolve(ev('z', { ctrl: true }), 'edit')?.command).toBe('undo');
    const off = km.bind('Enter', 'c');
    expect(km.resolve(ev('Enter'), 'grid')?.command).toBe('c');
    off();
    expect(km.resolve(ev('Enter'), 'grid')?.command).toBe('a');
    km.unbindCommand('a');
    expect(km.resolve(ev('Enter'), 'grid')).toBeNull();
  });
});
