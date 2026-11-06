export function Badge({ children, color = "var(--primary)" }: { children: React.ReactNode; color?: string }) {
  const bg = color.startsWith("var(") ? "color-mix(in srgb, var(--primary) 18%, white)" : color + "20";
  return (
    <span
      className="inline-block whitespace-nowrap rounded-xl px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}
