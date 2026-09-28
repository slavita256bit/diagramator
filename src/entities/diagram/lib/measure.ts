import type { ClassNode, StyleProfile } from "@/shared/types";
import { cssFontFamily } from "@/shared/config";

export const STEREOTYPE: Partial<Record<ClassNode["kind"], string>> = {
  interface: "«interface»",
  struct: "«struct»",
  enum: "«enumeration»",
  union: "«union»",
};

export const isAbstractClass = (cls: ClassNode) =>
  cls.kind === "interface" || cls.methods.some((m) => m.includes("{abstract}"));

let ctx: CanvasRenderingContext2D | null = null;

function textWidth(text: string, font: string): number {
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * 7;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/**
 * Exact box size for a class in the given style. The editor node (`UmlClassNode`)
 * and the Typst exporter both lay rows out with fixed heights, so this is what
 * keeps the two renderings identical.
 */
export function measureClass(cls: ClassNode, s: StyleProfile): { width: number; height: number } {
  const family = cssFontFamily(s.font);
  const italic = isAbstractClass(cls) ? "italic " : "";
  const nameFont = `${italic}${s.nameBold ? "bold " : ""}${s.nameFontSize}px ${family}`;
  const badge = s.kindBadge ? s.lineHeight * 0.8 + s.nameFontSize * 0.3 : 0;
  const stereotype = STEREOTYPE[cls.kind];
  const widths = [
    textWidth(cls.name, nameFont) + badge,
    stereotype ? textWidth(stereotype, `${s.stereotypeFontSize}px ${family}`) : 0,
    ...[...cls.attributes, ...cls.methods].map((m) =>
      textWidth(m, `${m.includes("{abstract}") ? "italic " : ""}${s.fontSize}px ${family}`),
    ),
  ];
  // +4: rounding slack so text never ellipsizes at exactly-fitting widths.
  const width = Math.ceil(Math.max(...widths) + 2 * s.paddingX + 2 * s.borderWidth + 4);
  const rows = (n: number) => Math.max(n, 1) * s.lineHeight + 2 * s.paddingY;
  const height =
    2 * s.borderWidth +
    (stereotype ? 2 : 1) * s.lineHeight +
    2 * s.paddingY +
    2 * s.borderWidth + // dividers
    rows(cls.attributes.length) +
    rows(cls.methods.length);
  return { width, height };
}
