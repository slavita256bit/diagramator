import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";

export const exportTypst = (): AppThunk<Promise<void>> => async (_, getState) => {
  const { diagram } = getState().diagram;
  if (!diagram) return;
  const path = await backend.pickSavePath("Export Typst", "diagram.typ", ["typ"]);
  if (path) await backend.exportTypst(path, diagram, getState().settings.style);
};
