import { computeRoutesAsync, exportPathChanged } from "@/entities/diagram";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";

export const exportTypst = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { diagram, exportPath, projectDir } = getState().diagram;
  if (!diagram) return;
  const path = await backend.pickSavePath("Export Typst", exportPath ?? "diagram.typ", ["typ"]);
  if (path) {
    const { style, hiddenRelationTypes } = getState().settings;
    const routes = await computeRoutesAsync(diagram, style);
    await backend.exportTypst(path, { ...diagram,
      relations: diagram.relations.map((r, i) => ({ ...r, route: routes[i] })) }, style, hiddenRelationTypes);
    if (getState().diagram.projectDir === projectDir && getState().diagram.status === "succeeded") {
      dispatch(exportPathChanged(path));
    }
  }
};
