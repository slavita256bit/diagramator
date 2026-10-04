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

/** Member-icon colors by UML visibility (fixed convention, mirrors `typst.rs`). */
const VIS_COLOR: Record<string, string> = {
  "+": "#2e7d32",
  "#": "#ef6c00",
  "-": "#c62828",
  "~": "#1565c0",
};

/** Splits a UML member line into its leading visibility symbol and the rest. */
export function splitVisibility(line: string): { symbol: string; rest: string; color: string } {
  const symbol = line.charAt(0) || "+";
  return { symbol, rest: line.slice(1).trimStart(), color: VIS_COLOR[symbol] ?? VIS_COLOR["+"] };
}

/** Separates a member line's trailing `{abstract}`/`{static}` tags from its core text. */
function splitTags(line: string): [string, string] {
  const i = line.indexOf(" {");
  return i === -1 ? [line, ""] : [line.slice(0, i), line.slice(i)];
}

/**
 * Applies method-signature verbosity: optionally blanks the parameter list and/or drops the
 * `: ReturnType` suffix. No-op for lines without parens (i.e. attributes). Mirrors `typst.rs`'s
 * `format_method`.
 */
export function formatMethodSignature(line: string, showParams: boolean, showReturnType: boolean): string {
  const [core, tags] = splitTags(line);
  const open = core.indexOf("(");
  if (open === -1) return line;
  let depth = 0;
  let close = -1;
  for (let i = open; i < core.length; i++) {
    if (core[i] === "(") depth++;
    else if (core[i] === ")" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close === -1) return line;
  const head = core.slice(0, open);
  const params = showParams ? core.slice(open + 1, close) : "";
  const rest = showReturnType ? core.slice(close + 1) : "";
  return `${head}(${params})${rest}${tags}`;
}

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
  const stereotype = s.showStereotype ? STEREOTYPE[cls.kind] : undefined;
  // GOST: interfaces omit the attributes compartment entirely, not just show it empty.
  const hideAttrs = s.interfaceHidesAttributes && cls.kind === "interface";
  const templateHeader =
    s.templateNotation === "header" && cls.templateParams.length > 0
      ? `template<${cls.templateParams.join(", ")}>`
      : undefined;

  const memberWidth = (m: string, isMethod: boolean) => {
    const text = isMethod ? formatMethodSignature(m, s.showMethodParams, s.showMethodReturnType) : m;
    const shown = s.memberIconStyle === "text" ? text : splitVisibility(text).rest;
    // Icon box + gap, in place of the visibility-symbol text it replaces.
    const iconReserve = s.memberIconStyle === "text" ? 0 : s.lineHeight * 0.9;
    const style = m.includes("{abstract}") ? "italic " : "";
    return textWidth(shown, `${style}${s.fontSize}px ${family}`) + iconReserve;
  };

  const widths = [
    textWidth(cls.name, nameFont) + badge,
    stereotype ? textWidth(stereotype, `${s.stereotypeFontSize}px ${family}`) : 0,
    templateHeader ? textWidth(templateHeader, `italic ${s.stereotypeFontSize}px ${family}`) : 0,
    ...(hideAttrs ? [] : cls.attributes.map((m) => memberWidth(m, false))),
    ...cls.methods.map((m) => memberWidth(m, true)),
  ];
  // +4: rounding slack so text never ellipsizes at exactly-fitting widths.
  const width = Math.ceil(Math.max(...widths) + 2 * s.paddingX + 2 * s.borderWidth + 4);

  // Mirrors typst.rs's `_class` stack: header block, then (unless hidden) a divider + attributes
  // section, then a divider + methods section (always present — GOST: "may be empty, but is
  // still marked by a horizontal line"). A collapsed section measures as if it had 0 items,
  // i.e. exactly like an empty one — same code path, no new height logic.
  const rows = (n: number) => Math.max(n, 1) * s.lineHeight + 2 * s.paddingY;
  const headerRows = 1 + (stereotype ? 1 : 0) + (templateHeader ? 1 : 0);
  const height =
    2 * s.borderWidth +
    headerRows * s.lineHeight +
    2 * s.paddingY +
    (hideAttrs ? 0 : s.borderWidth + rows(cls.attributesCollapsed ? 0 : cls.attributes.length)) +
    s.borderWidth +
    rows(cls.methodsCollapsed ? 0 : cls.methods.length);
  return { width, height };
}
