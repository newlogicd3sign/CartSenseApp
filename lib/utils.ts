// Design system accent colors (excluding the primary blue to add variety)
export const ACCENT_COLORS: AccentColor[] = [
  { primary: "#10b981", dark: "#059669" }, // green (success)
  { primary: "#f97316", dark: "#ea580c" }, // orange (warning)
  { primary: "#a855f7", dark: "#9333ea" }, // purple
  { primary: "#3b82f6", dark: "#2563eb" }, // blue
  { primary: "#ec4899", dark: "#db2777" }, // pink
  { primary: "#14b8a6", dark: "#0d9488" }, // teal
];

export type AccentColor = { primary: string; dark: string };

export function getRandomAccentColor(): AccentColor {
  return ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
}

export function getRandomAccentColorExcluding(exclude: AccentColor): AccentColor {
  const filtered = ACCENT_COLORS.filter(c => c.primary !== exclude.primary);
  return filtered[Math.floor(Math.random() * filtered.length)];
}