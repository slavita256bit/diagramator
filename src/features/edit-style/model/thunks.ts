import { classesResized, measureClass } from "@/entities/diagram";
import { styleSet } from "@/entities/settings";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";
import type { StyleProfile } from "@/shared/types";

/** Switch style and resize every class box to fit it. */
export const applyStyle =
  (style: StyleProfile): AppThunk =>
  (dispatch, getState) => {
    dispatch(styleSet(style));
    const classes = getState().diagram.diagram?.classes ?? [];
    dispatch(classesResized(Object.fromEntries(classes.map((c) => [c.id, measureClass(c, style)]))));
  };

export const importStyle = (): AppThunk<Promise<void>> => async (dispatch) => {
  const path = await backend.pickFile("Import style", ["json"]);
  if (path) dispatch(applyStyle(await backend.readStyle(path)));
};

export const exportStyle = (): AppThunk<Promise<void>> => async (_, getState) => {
  const style = getState().settings.style;
  const name = style.name.toLowerCase().replace(/[^a-z0-9а-я]+/gi, "-") || "style";
  const path = await backend.pickSavePath("Export style", `${name}.json`, ["json"]);
  if (path) await backend.writeStyle(path, style);
};
