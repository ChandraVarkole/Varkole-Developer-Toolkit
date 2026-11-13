import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyThemePreference, DEFAULT_THEME, readThemePreference } from './theme';

describe('theme preferences', () => {
  const stored = new Map<string, string>();
  const properties = new Map<string, string>();

  beforeEach(() => {
    stored.clear();
    properties.clear();
    vi.stubGlobal('localStorage', {
      clear: () => stored.clear(),
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {} as Record<string, string>,
        style: {
          setProperty: (key: string, value: string) => properties.set(key, value),
          getPropertyValue: (key: string) => properties.get(key) ?? '',
        },
      },
    });
  });

  it('falls back to the Ocean theme when storage is empty or invalid', () => {
    localStorage.clear();
    expect(readThemePreference()).toEqual(DEFAULT_THEME);
    localStorage.setItem('varkole-theme', '{bad json');
    expect(readThemePreference()).toEqual(DEFAULT_THEME);
  });

  it('applies a custom accent and derived theme colors', () => {
    applyThemePreference({ id: 'custom', customColor: '#a040c0' });
    expect(document.documentElement.dataset.theme).toBe('custom');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#a040c0');
    expect(document.documentElement.style.getPropertyValue('--sidebar-top')).toMatch(
      /^#[0-9a-f]{6}$/,
    );
  });
});
