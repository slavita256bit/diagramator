import { computeRoutesAsync } from "@/entities/diagram";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";

export const exportTypst = (): AppThunk<Promise<void>> => async (_, getState) => {
  const { diagram } = getState().diagram;
  if (!diagram) return;
  const path = await backend.pickSavePath("Export Typst", "diagram.typ", ["typ"]);
  if (path) {
    const style = getState().settings.style;
    const routes = await computeRoutesAsync(diagram, style);
    await backend.exportTypst(path, { ...diagram,
      relations: diagram.relations.map((r, i) => ({ ...r, route: routes[i] })) }, style);
  }
};
