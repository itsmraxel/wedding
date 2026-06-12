// Notion-ish tints for group badges. Keys are stored in groups.color.
export const GROUP_COLORS: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  default: { label: "Gray", bg: "#f1f1ef", text: "#5f5e5b" },
  orange: { label: "Orange", bg: "#faebdd", text: "#b95c00" },
  blue: { label: "Blue", bg: "#e7f3f8", text: "#2d6f95" },
  purple: { label: "Purple", bg: "#f6f3f9", text: "#8250a8" },
  green: { label: "Green", bg: "#edf3ec", text: "#3c7a4e" },
  pink: { label: "Pink", bg: "#fbf2f5", text: "#b54a74" },
};

export function groupColorStyle(color?: string) {
  const c = GROUP_COLORS[color ?? "default"] ?? GROUP_COLORS.default;
  return { backgroundColor: c.bg, color: c.text };
}
