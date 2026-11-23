import { computeRoutesAsync, loadFailed, saveStatusChanged } from "@/entities/diagram";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";

// Keep a save started before undo from finishing after the restored version is saved.
let pendingSave = Promise.resolve();

const writeProject = (requestedDir: string): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { diagram, projectDir, exportPath, autoExport } = getState().diagram;
  if (!diagram || projectDir !== requestedDir) return;
  dispatch(saveStatusChanged("saving"));
  try {
    const { style, hiddenRelationTypes } = getState().settings;
    const routes = await computeRoutesAsync(diagram, style);
    const routed = { ...diagram, relations: diagram.relations.map((r, i) => ({ ...r, route: routes[i] })) };
    await backend.saveProject(projectDir, routed, style, exportPath, hiddenRelationTypes, autoExport);
    // An edit that landed while saving keeps the project "unsaved" for the next autosave.
    const current = getState().diagram;
    if (current.projectDir === projectDir && current.saveStatus === "saving") dispatch(saveStatusChanged("saved"));
  } catch (e) {
    if (getState().diagram.projectDir !== projectDir) return;
    dispatch(saveStatusChanged("failed"));
    dispatch(loadFailed(`Save failed: ${e}`));
  }
};

/** Write `diagramator.json` and regenerate the Typst file when auto-export is enabled. */
export const saveProject = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { projectDir } = getState().diagram;
  if (!projectDir || !backend.available) return;
  const save = pendingSave.then(() => dispatch(writeProject(projectDir)));
  pendingSave = save.catch(() => {});
  await save;
};
