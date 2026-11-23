let context: CanvasRenderingContext2D | null | undefined;
const PT_TO_MM = 25.4 / 72;

export function wrapText(text: string, fontSize: number, width: number): string[] {
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return text.split("\n");
  const fontSizeMm = fontSize * PT_TO_MM;
  context.font = `${fontSizeMm * 10}px Arial, sans-serif`;
  const fits = (value: string) => context!.measureText(value).width <= width * 10;
  return text.split("\n").flatMap((paragraph) => {
    let line = "";
    const lines = [];
    for (const word of paragraph.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && !fits(next)) { lines.push(line); line = word; }
      else line = next;
      if (!fits(line)) {
        const overflow = Array.from(line);
        line = "";
        for (const char of overflow) {
          if (line && !fits(line + char)) { lines.push(line); line = ""; }
          line += char;
        }
      }
    }
    return [...lines, line];
  });
}

export const fontMillimeters = (size: number) => size * PT_TO_MM;
export const lineHeight = (size: number) => fontMillimeters(size) * 1.25;
export const commentHeight = (text: string, size: number, width: number) =>
  Math.ceil(wrapText(text, size, width - 6).length * lineHeight(size) + 4);
