import { loadFailed, saveStatusChanged } from "@/entities/diagram";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";

/** Write `diagramator.json` and regenerate the Typst file (if auto-export is on). */
export const saveProject = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { diagram, projectDir } = getState().diagram;
  if (!diagram || !projectDir || !backend.available) return;
  dispatch(saveStatusChanged("saving"));
  try {
    await backend.saveProject(projectDir, diagram, getState().settings.style);
    // An edit that landed while saving keeps the project "unsaved" for the next autosave.
    if (getState().diagram.saveStatus === "saving") dispatch(saveStatusChanged("saved"));
  } catch (e) {
    dispatch(saveStatusChanged("failed"));
    dispatch(loadFailed(`Save failed: ${e}`));
  }
};
