export type ThemeId = 'ocean' | 'violet' | 'emerald' | 'sunset' | 'slate' | 'custom';

export interface ThemePreference {
  id: ThemeId;
  customColor: string;
}

export interface ThemeOption {
  id: Exclude<ThemeId, 'custom'>;
  label: string;
  color: string;
  secondary: string;
  sidebarTop: string;
  sidebarBottom: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'ocean',
    label: 'Ocean',
    color: '#087ff5',
    secondary: '#08c7ed',
    sidebarTop: '#071d50',
    sidebarBottom: '#061238',
  },
  {
    id: 'violet',
    label: 'Violet',
    color: '#7657e8',
    secondary: '#b06cff',
    sidebarTop: '#251354',
    sidebarBottom: '#140b35',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    color: '#078b68',
    secondary: '#21c790',
    sidebarTop: '#063c38',
    sidebarBottom: '#042925',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    color: '#e2672f',
    secondary: '#f5a524',
    sidebarTop: '#502213',
    sidebarBottom: '#32140d',
  },
  {
    id: 'slate',
    label: 'Slate',
    color: '#526780',
    secondary: '#8193a8',
    sidebarTop: '#263442',
    sidebarBottom: '#18222c',
  },
];

export const DEFAULT_THEME: ThemePreference = { id: 'ocean', customColor: '#087ff5' };

const STORAGE_KEY = 'varkole-theme';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function readThemePreference(): ThemePreference {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<ThemePreference>;
    const validId = [...THEME_OPTIONS.map((option) => option.id), 'custom'].includes(
      stored?.id as ThemeId,
    );
    return {
      id: validId ? (stored.id as ThemeId) : DEFAULT_THEME.id,
      customColor: HEX_COLOR.test(stored?.customColor ?? '')
        ? stored.customColor!
        : DEFAULT_THEME.customColor,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  const option = THEME_OPTIONS.find((candidate) => candidate.id === preference.id);
  const accent = option?.color ?? preference.customColor;
  const secondary = option?.secondary ?? mixHex(accent, '#ffffff', 0.3);
  const sidebarTop = option?.sidebarTop ?? mixHex(accent, '#061238', 0.76);
  const sidebarBottom = option?.sidebarBottom ?? mixHex(accent, '#03091d', 0.86);

  root.dataset.theme = preference.id;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-strong', mixHex(accent, '#000000', 0.18));
  root.style.setProperty('--accent-secondary', secondary);
  root.style.setProperty('--sidebar-top', sidebarTop);
  root.style.setProperty('--sidebar-bottom', sidebarBottom);
}

function mixHex(left: string, right: string, rightWeight: number): string {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);
  const mix = (first: number, second: number) =>
    Math.round(first * (1 - rightWeight) + second * rightWeight);
  return `#${[
    mix(leftRgb[0], rightRgb[0]),
    mix(leftRgb[1], rightRgb[1]),
    mix(leftRgb[2], rightRgb[2]),
  ]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToRgb(value: string): [number, number, number] {
  const normalized = HEX_COLOR.test(value) ? value.slice(1) : DEFAULT_THEME.customColor.slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
