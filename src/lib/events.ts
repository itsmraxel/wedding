export type EventKey = "traditional" | "white";

export const EVENTS: Record<
  EventKey,
  { label: string; tone: string; dot: string }
> = {
  traditional: {
    label: "Traditional Wedding",
    tone: "tone-traditional",
    dot: "bg-[var(--traditional)]",
  },
  white: {
    label: "White Wedding",
    tone: "tone-white",
    dot: "bg-[var(--white-wedding)]",
  },
};
