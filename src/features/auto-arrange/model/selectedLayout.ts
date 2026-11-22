import type { ClassNode } from "../../../shared/types/diagram";

/** The backend estimates sizes; space its rows again using the editor's measured sizes. */
export function spaceLayout(classes: ClassNode[]): ClassNode[] {
  const rows = new Map<number, ClassNode[]>();
  for (const cls of classes) {
    const row = rows.get(cls.position.y) ?? [];
    row.push(cls);
    rows.set(cls.position.y, row);
  }
  let y = 0;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [, row] of [...rows].sort(([a], [b]) => a - b)) {
    let x = 0;
    for (const cls of row.sort((a, b) => a.position.x - b.position.x)) {
      positions.set(cls.id, { x, y });
      x += cls.position.width + 60;
    }
    y += Math.max(...row.map((c) => c.position.height)) + 100;
  }
  return classes.map((c) => ({ ...c, position: { ...c.position, ...positions.get(c.id)! } }));
}
