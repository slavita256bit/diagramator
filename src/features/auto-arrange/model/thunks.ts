import { diagramArranged, sizeDiagram } from "@/entities/diagram";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";

/** Re-lays out the current diagram (layered by inheritance), discarding manual positions. */
export const autoArrange = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { diagram } = getState().diagram;
  if (!diagram || !backend.available) return;
  const relaid = await backend.autoArrange(diagram);
  dispatch(diagramArranged(sizeDiagram(relaid, getState().settings.style)));
};
